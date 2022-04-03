import { nmap } from './lib/nmap';
import { getTailModal } from './lib/modal';
import * as d3 from './lib/d3'

/** @param {NS} ns **/
async function showChart(ns, element, nodes, links) {
  const width = 1000;
  const height =  1000;
  const font = ['monospace', "Lucida Console", "Lucida Sans Unicode", "Fira Mono", "Consolas", "Courier New", "Courier", "monospace", "Times New Roman"]
    .map(f=>JSON.stringify(f)).join(',');
  const theme = ns.ui.getTheme();

  const container = d3.select(element).append("div")
      .classed("svg-container", true)
      .style('position', 'relative')
      .attr('style', 'max-width: 100%; max-height: 100%')

  const chart = container.append('svg')
      .attr("preserveAspectRatio", "xMinYMin meet")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr('style', 'max-width: 100%; max-height: 100%')
      .classed("svg-content-responsive", true)
  
  var tooltip = container.append("div")	
    .attr("class", "tooltip")
    .style('position', 'absolute')
    .style('background', 'black')
    .style('color', theme.primary)
    .style('border', 'solid 1px ' + theme.primary)
    .style('padding', '.3em')
    .style('font-family', font)
    .style("display", 'none');

  const simulation = d3.forceSimulation()
    .nodes(nodes)
    .force("link", d3.forceLink().distance(50))
    .force("gravity", d3.forceManyBody().strength(100))
    .force("charge", d3.forceManyBody().strength(-450))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(1))
    .force("y", d3.forceY(0))
    .force("x", d3.forceX(0));

  ns.atExit(() => {
    tooltip.remove();
    chart.remove();
    container.remove();
    simulation.stop();
  })

  const { nFormat } = ns;

  simulation.force('link').links(links);

  const link = chart
    .append("g")
    .attr("class", "links")
    .selectAll('line') 
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', theme.primary + '33')
    .attr('strokewidth', '1');

  const node =  chart.selectAll('circle')  
    .data(nodes)
    .enter() 
    .append('g')
    .style('cursor', 'default')
    .on("mouseover", function(event, d) {
      const {
        maxRam,
        isFullyAccessed,
        numOpenPortsRequired,
        requiredHackingSkill,
        nMoneyAvailable,
        nMoneyMax,
      } = d;
      const color = isFullyAccessed ? theme.primary : theme.primary + 'AA';
      const scale = Math.min(element.clientWidth, element.clientHeight) / 1000;
      const info = isFullyAccessed ?
        `${nMoneyAvailable}/${nMoneyMax}` :
        `${maxRam}GB ports=${numOpenPortsRequired} hack=${requiredHackingSkill}`;
      tooltip.style("display", 'block');
      tooltip.style("color", color);
      tooltip.style("border-color", color);
      tooltip.html(`<strong>${d.name}</strong> <span style="font-size: .9em">${info}</span>`)	
        .style("left", (d.x * scale - 100) + "px")		
        .style("top", (d.y * scale - 20) + "px");	
    })					
    .on("mouseout", () => tooltip.style("display", 'none'))
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  simulation.on('tick', function(e){ 
    node.attr('transform', function(d, i){
      return 'translate(' + d.x + ','+ d.y + ')'
    });

    link 
      .attr('x1', function(d){ return d.source.x; }) 
      .attr('y1', function(d){ return d.source.y; })
      .attr('x2', function(d){ return d.target.x; })
      .attr('y2', function(d){ return d.target.y; })
  });


  node.append('text')
    .text(function(d){ return d.name; })
    .attr('font-family', font)
    .attr('text-anchor', 'middle')
    .attr('font-weight', (d, i) => (i===0) ? 'bold' : 'normal')
    .attr('font-size', (d) => {
      const { name } = d;
      if (name.length <= 10)
        return '1.25em';
      else return `${.75 + (.5 * 10 / name.length)}em`;
    });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.9).restart();
    if (!d.selected && !event.shiftKey) {
      node.classed("selected", function(p) {
        return p.selected =  p.previouslySelected = false;
      });
    }

    d3.select(this).classed("selected", function(p) {
      d.previouslySelected = d.selected; return d.selected = true;
    });

    node.filter(function(d) { return d.selected; })
      .each(function(d) {
        d.fx = d.x;
        d.fy = d.y;
      })
  }

  function dragged(event, d) {
    node.filter(d => d.selected).each((d) => { 
      d.fx += event.dx;
      d.fy += event.dy;
    })
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
    node.filter(d => d.selected).each(function(d) {
      d.fx = null;
      d.fy = null;
    })
  }
  while(true) {
    if (element.offsetParent == null)
      ns.exit();
    node.selectAll('text').attr('fill', function(d){
      const skill = ns.getHackingLevel();
      const server = ns.getServer(d.name);
      Object.assign(d, server);
      const {
        backdoorInstalled,
        openPortCount,
        numOpenPortsRequired,
        requiredHackingSkill,
        purchasedByPlayer,
      } = server;
      d.isFullyAccessed = d.name === 'home' || purchasedByPlayer || backdoorInstalled;
      d.nMoneyAvailable = ns.nFormat(server.moneyAvailable, '$0.000a');
      d.nMoneyMax = ns.nFormat(server.moneyMax, '$0.000a');
      if (d.isFullyAccessed)
        return theme.primary; //palette.text;
      else if (skill >= requiredHackingSkill && openPortCount >= numOpenPortsRequired)
        return theme.primarylight;
      else
        return theme.primary + '77';
    });
    await ns.sleep(50);
  }
}

/** @param {NS} ns **/
export async function main(ns) {
    // ns.tprint(nmap(ns));
    const servers = nmap(ns).filter(x=>!x.startsWith('THREADPOOL'));
    const nodes = servers.map(hostname => {
        const neighbors = ns.scan(hostname).map(other=>servers.indexOf(other)).filter(x=>x!==-1);
        return {
            name: hostname,
            // server: ns.getServer(server),
            target: neighbors,
            link: 1,
            ...ns.getServer(hostname)
        }
    });
    const links = nodes.map((node, source)=>
        node.target.map(target=>({ source, target }))).flat();
    const elem = await getTailModal(ns);

    const resizeable = elem.children[0];
    resizeable.style.width = '500px';
    resizeable.style.height = '500px';
    resizeable.children[0].remove();
    await showChart(ns, resizeable, nodes, links);
}