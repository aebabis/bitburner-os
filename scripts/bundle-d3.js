import esbuild from 'esbuild';

await esbuild.build({
    stdin: {
        contents: `export * from 'd3-selection';
export * from 'd3-force';
export * from 'd3-drag';`,
        resolveDir: new URL('..', import.meta.url).pathname,
    },
    bundle: true,
    format: 'esm',
    outfile: 'home/lib/d3.js',
    minify: true,
});
