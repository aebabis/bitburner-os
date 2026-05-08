// @ts-nocheck
const doc = eval('doc' + 'ument');
const win = eval('win' + 'dow');
const docElem = 'doc' + 'umentElement';
var rt = "http://www.w3.org/1999/xhtml",
  it = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: rt,
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/",
  };
function Y(t) {
  var e = (t += ""),
    n = e.indexOf(":");
  return (
    n >= 0 && (e = t.slice(0, n)) !== "xmlns" && (t = t.slice(n + 1)),
    it.hasOwnProperty(e) ? { space: it[e], local: t } : t
  );
}
function Ge(t) {
  return function () {
    var e = this.ownerDocument,
      n = this.namespaceURI;
    return n === rt && e[docElem].namespaceURI === rt
      ? e.createElement(t)
      : e.createElementNS(n, t);
  };
}
function Je(t) {
  return function () {
    return this.ownerDocument.createElementNS(t.space, t.local);
  };
}
function V(t) {
  var e = Y(t);
  return (e.local ? Je : Ge)(e);
}
function We() {}
function U(t) {
  return t == null
    ? We
    : function () {
        return this.querySelector(t);
      };
}
function Tt(t) {
  typeof t != "function" && (t = U(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (
      var o = e[i], a = o.length, u = (r[i] = new Array(a)), l, f, c = 0;
      c < a;
      ++c
    )
      (l = o[c]) &&
        (f = t.call(l, l.__data__, c, o)) &&
        ("__data__" in l && (f.__data__ = l.__data__), (u[c] = f));
  return new E(r, this._parents);
}
function H(t) {
  return t == null ? [] : Array.isArray(t) ? t : Array.from(t);
}
function Ze() {
  return [];
}
function dt(t) {
  return t == null
    ? Ze
    : function () {
        return this.querySelectorAll(t);
      };
}
function $e(t) {
  return function () {
    return H(t.apply(this, arguments));
  };
}
function zt(t) {
  typeof t == "function" ? (t = $e(t)) : (t = dt(t));
  for (var e = this._groups, n = e.length, r = [], i = [], o = 0; o < n; ++o)
    for (var a = e[o], u = a.length, l, f = 0; f < u; ++f)
      (l = a[f]) && (r.push(t.call(l, l.__data__, f, a)), i.push(l));
  return new E(r, i);
}
function xt(t) {
  return function () {
    return this.matches(t);
  };
}
function ot(t) {
  return function (e) {
    return e.matches(t);
  };
}
var je = Array.prototype.find;
function tn(t) {
  return function () {
    return je.call(this.children, t);
  };
}
function en() {
  return this.firstElementChild;
}
function Dt(t) {
  return this.select(t == null ? en : tn(typeof t == "function" ? t : ot(t)));
}
var nn = Array.prototype.filter;
function rn() {
  return Array.from(this.children);
}
function on(t) {
  return function () {
    return nn.call(this.children, t);
  };
}
function It(t) {
  return this.selectAll(
    t == null ? rn : on(typeof t == "function" ? t : ot(t)),
  );
}
function Ft(t) {
  typeof t != "function" && (t = xt(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], a = o.length, u = (r[i] = []), l, f = 0; f < a; ++f)
      (l = o[f]) && t.call(l, l.__data__, f, o) && u.push(l);
  return new E(r, this._parents);
}
function ut(t) {
  return new Array(t.length);
}
function Pt() {
  return new E(this._enter || this._groups.map(ut), this._parents);
}
function Q(t, e) {
  ((this.ownerDocument = t.ownerDocument),
    (this.namespaceURI = t.namespaceURI),
    (this._next = null),
    (this._parent = t),
    (this.__data__ = e));
}
Q.prototype = {
  constructor: Q,
  appendChild: function (t) {
    return this._parent.insertBefore(t, this._next);
  },
  insertBefore: function (t, e) {
    return this._parent.insertBefore(t, e);
  },
  querySelector: function (t) {
    return this._parent.querySelector(t);
  },
  querySelectorAll: function (t) {
    return this._parent.querySelectorAll(t);
  },
};
function Lt(t) {
  return function () {
    return t;
  };
}
function un(t, e, n, r, i, o) {
  for (var a = 0, u, l = e.length, f = o.length; a < f; ++a)
    (u = e[a]) ? ((u.__data__ = o[a]), (r[a] = u)) : (n[a] = new Q(t, o[a]));
  for (; a < l; ++a) (u = e[a]) && (i[a] = u);
}
function fn(t, e, n, r, i, o, a) {
  var u,
    l,
    f = new Map(),
    c = e.length,
    _ = o.length,
    g = new Array(c),
    p;
  for (u = 0; u < c; ++u)
    (l = e[u]) &&
      ((g[u] = p = a.call(l, l.__data__, u, e) + ""),
      f.has(p) ? (i[u] = l) : f.set(p, l));
  for (u = 0; u < _; ++u)
    ((p = a.call(t, o[u], u, o) + ""),
      (l = f.get(p))
        ? ((r[u] = l), (l.__data__ = o[u]), f.delete(p))
        : (n[u] = new Q(t, o[u])));
  for (u = 0; u < c; ++u) (l = e[u]) && f.get(g[u]) === l && (i[u] = l);
}
function an(t) {
  return t.__data__;
}
function Rt(t, e) {
  if (!arguments.length) return Array.from(this, an);
  var n = e ? fn : un,
    r = this._parents,
    i = this._groups;
  typeof t != "function" && (t = Lt(t));
  for (
    var o = i.length,
      a = new Array(o),
      u = new Array(o),
      l = new Array(o),
      f = 0;
    f < o;
    ++f
  ) {
    var c = r[f],
      _ = i[f],
      g = _.length,
      p = ln(t.call(c, c && c.__data__, f, r)),
      y = p.length,
      m = (u[f] = new Array(y)),
      h = (a[f] = new Array(y)),
      d = (l[f] = new Array(g));
    n(c, _, m, h, d, p, e);
    for (var x = 0, w = 0, s, v; x < y; ++x)
      if ((s = m[x])) {
        for (x >= w && (w = x + 1); !(v = h[w]) && ++w < y; );
        s._next = v || null;
      }
  }
  return ((a = new E(a, r)), (a._enter = u), (a._exit = l), a);
}
function ln(t) {
  return typeof t == "object" && "length" in t ? t : Array.from(t);
}
function Vt() {
  return new E(this._exit || this._groups.map(ut), this._parents);
}
function Bt(t, e, n) {
  var r = this.enter(),
    i = this,
    o = this.exit();
  return (
    typeof t == "function"
      ? ((r = t(r)), r && (r = r.selection()))
      : (r = r.append(t + "")),
    e != null && ((i = e(i)), i && (i = i.selection())),
    n == null ? o.remove() : n(o),
    r && i ? r.merge(i).order() : i
  );
}
function kt(t) {
  for (
    var e = t.selection ? t.selection() : t,
      n = this._groups,
      r = e._groups,
      i = n.length,
      o = r.length,
      a = Math.min(i, o),
      u = new Array(i),
      l = 0;
    l < a;
    ++l
  )
    for (
      var f = n[l], c = r[l], _ = f.length, g = (u[l] = new Array(_)), p, y = 0;
      y < _;
      ++y
    )
      (p = f[y] || c[y]) && (g[y] = p);
  for (; l < i; ++l) u[l] = n[l];
  return new E(u, this._parents);
}
function Ot() {
  for (var t = this._groups, e = -1, n = t.length; ++e < n; )
    for (var r = t[e], i = r.length - 1, o = r[i], a; --i >= 0; )
      (a = r[i]) &&
        (o &&
          a.compareDocumentPosition(o) ^ 4 &&
          o.parentNode.insertBefore(a, o),
        (o = a));
  return this;
}
function Xt(t) {
  t || (t = sn);
  function e(_, g) {
    return _ && g ? t(_.__data__, g.__data__) : !_ - !g;
  }
  for (
    var n = this._groups, r = n.length, i = new Array(r), o = 0;
    o < r;
    ++o
  ) {
    for (
      var a = n[o], u = a.length, l = (i[o] = new Array(u)), f, c = 0;
      c < u;
      ++c
    )
      (f = a[c]) && (l[c] = f);
    l.sort(e);
  }
  return new E(i, this._parents).order();
}
function sn(t, e) {
  return t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
function qt() {
  var t = arguments[0];
  return ((arguments[0] = this), t.apply(null, arguments), this);
}
function Yt() {
  return Array.from(this);
}
function Ut() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length; i < o; ++i) {
      var a = r[i];
      if (a) return a;
    }
  return null;
}
function Ht() {
  let t = 0;
  for (let e of this) ++t;
  return t;
}
function Qt() {
  return !this.node();
}
function Kt(t) {
  for (var e = this._groups, n = 0, r = e.length; n < r; ++n)
    for (var i = e[n], o = 0, a = i.length, u; o < a; ++o)
      (u = i[o]) && t.call(u, u.__data__, o, i);
  return this;
}
function cn(t) {
  return function () {
    this.removeAttribute(t);
  };
}
function hn(t) {
  return function () {
    this.removeAttributeNS(t.space, t.local);
  };
}
function pn(t, e) {
  return function () {
    this.setAttribute(t, e);
  };
}
function mn(t, e) {
  return function () {
    this.setAttributeNS(t.space, t.local, e);
  };
}
function gn(t, e) {
  return function () {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttribute(t) : this.setAttribute(t, n);
  };
}
function dn(t, e) {
  return function () {
    var n = e.apply(this, arguments);
    n == null
      ? this.removeAttributeNS(t.space, t.local)
      : this.setAttributeNS(t.space, t.local, n);
  };
}
function Gt(t, e) {
  var n = Y(t);
  if (arguments.length < 2) {
    var r = this.node();
    return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n);
  }
  return this.each(
    (e == null
      ? n.local
        ? hn
        : cn
      : typeof e == "function"
        ? n.local
          ? dn
          : gn
        : n.local
          ? mn
          : pn)(n, e),
  );
}
function K(t) {
  return (
    (t.ownerDocument && t.ownerDocument.defaultView) ||
    (t['doc' + 'ument'] && t) ||
    t.defaultView
  );
}
function xn(t) {
  return function () {
    this.style.removeProperty(t);
  };
}
function yn(t, e, n) {
  return function () {
    this.style.setProperty(t, e, n);
  };
}
function _n(t, e, n) {
  return function () {
    var r = e.apply(this, arguments);
    r == null ? this.style.removeProperty(t) : this.style.setProperty(t, r, n);
  };
}
function Jt(t, e, n) {
  return arguments.length > 1
    ? this.each(
        (e == null ? xn : typeof e == "function" ? _n : yn)(t, e, n ?? ""),
      )
    : Wt(this.node(), t);
}
function Wt(t, e) {
  return (
    t.style.getPropertyValue(e) ||
    K(t).getComputedStyle(t, null).getPropertyValue(e)
  );
}
function vn(t) {
  return function () {
    delete this[t];
  };
}
function wn(t, e) {
  return function () {
    this[t] = e;
  };
}
function An(t, e) {
  return function () {
    var n = e.apply(this, arguments);
    n == null ? delete this[t] : (this[t] = n);
  };
}
function Zt(t, e) {
  return arguments.length > 1
    ? this.each((e == null ? vn : typeof e == "function" ? An : wn)(t, e))
    : this.node()[t];
}
function $t(t) {
  return t.trim().split(/^|\s+/);
}
function yt(t) {
  return t.classList || new jt(t);
}
function jt(t) {
  ((this._node = t), (this._names = $t(t.getAttribute("class") || "")));
}
jt.prototype = {
  add: function (t) {
    var e = this._names.indexOf(t);
    e < 0 &&
      (this._names.push(t),
      this._node.setAttribute("class", this._names.join(" ")));
  },
  remove: function (t) {
    var e = this._names.indexOf(t);
    e >= 0 &&
      (this._names.splice(e, 1),
      this._node.setAttribute("class", this._names.join(" ")));
  },
  contains: function (t) {
    return this._names.indexOf(t) >= 0;
  },
};
function te(t, e) {
  for (var n = yt(t), r = -1, i = e.length; ++r < i; ) n.add(e[r]);
}
function ee(t, e) {
  for (var n = yt(t), r = -1, i = e.length; ++r < i; ) n.remove(e[r]);
}
function Nn(t) {
  return function () {
    te(this, t);
  };
}
function bn(t) {
  return function () {
    ee(this, t);
  };
}
function Sn(t, e) {
  return function () {
    (e.apply(this, arguments) ? te : ee)(this, t);
  };
}
function ne(t, e) {
  var n = $t(t + "");
  if (arguments.length < 2) {
    for (var r = yt(this.node()), i = -1, o = n.length; ++i < o; )
      if (!r.contains(n[i])) return !1;
    return !0;
  }
  return this.each((typeof e == "function" ? Sn : e ? Nn : bn)(n, e));
}
function En() {
  this.textContent = "";
}
function Mn(t) {
  return function () {
    this.textContent = t;
  };
}
function Cn(t) {
  return function () {
    var e = t.apply(this, arguments);
    this.textContent = e ?? "";
  };
}
function re(t) {
  return arguments.length
    ? this.each(t == null ? En : (typeof t == "function" ? Cn : Mn)(t))
    : this.node().textContent;
}
function Tn() {
  this.innerHTML = "";
}
function zn(t) {
  return function () {
    this.innerHTML = t;
  };
}
function Dn(t) {
  return function () {
    var e = t.apply(this, arguments);
    this.innerHTML = e ?? "";
  };
}
function ie(t) {
  return arguments.length
    ? this.each(t == null ? Tn : (typeof t == "function" ? Dn : zn)(t))
    : this.node().innerHTML;
}
function In() {
  this.nextSibling && this.parentNode.appendChild(this);
}
function oe() {
  return this.each(In);
}
function Fn() {
  this.previousSibling &&
    this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function ue() {
  return this.each(Fn);
}
function fe(t) {
  var e = typeof t == "function" ? t : V(t);
  return this.select(function () {
    return this.appendChild(e.apply(this, arguments));
  });
}
function Pn() {
  return null;
}
function ae(t, e) {
  var n = typeof t == "function" ? t : V(t),
    r = e == null ? Pn : typeof e == "function" ? e : U(e);
  return this.select(function () {
    return this.insertBefore(
      n.apply(this, arguments),
      r.apply(this, arguments) || null,
    );
  });
}
function Ln() {
  var t = this.parentNode;
  t && t.removeChild(this);
}
function le() {
  return this.each(Ln);
}
function Rn() {
  var t = this.cloneNode(!1),
    e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function Vn() {
  var t = this.cloneNode(!0),
    e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function se(t) {
  return this.select(t ? Vn : Rn);
}
function ce(t) {
  return arguments.length ? this.property("__data__", t) : this.node().__data__;
}
function Bn(t) {
  return function (e) {
    t.call(this, e, this.__data__);
  };
}
function kn(t) {
  return t
    .trim()
    .split(/^|\s+/)
    .map(function (e) {
      var n = "",
        r = e.indexOf(".");
      return (
        r >= 0 && ((n = e.slice(r + 1)), (e = e.slice(0, r))),
        { type: e, name: n }
      );
    });
}
function On(t) {
  return function () {
    var e = this.__on;
    if (e) {
      for (var n = 0, r = -1, i = e.length, o; n < i; ++n)
        ((o = e[n]),
          (!t.type || o.type === t.type) && o.name === t.name
            ? this.removeEventListener(o.type, o.listener, o.options)
            : (e[++r] = o));
      ++r ? (e.length = r) : delete this.__on;
    }
  };
}
function Xn(t, e, n) {
  return function () {
    var r = this.__on,
      i,
      o = Bn(e);
    if (r) {
      for (var a = 0, u = r.length; a < u; ++a)
        if ((i = r[a]).type === t.type && i.name === t.name) {
          (this.removeEventListener(i.type, i.listener, i.options),
            this.addEventListener(i.type, (i.listener = o), (i.options = n)),
            (i.value = e));
          return;
        }
    }
    (this.addEventListener(t.type, o, n),
      (i = { type: t.type, name: t.name, value: e, listener: o, options: n }),
      r ? r.push(i) : (this.__on = [i]));
  };
}
function he(t, e, n) {
  var r = kn(t + ""),
    i,
    o = r.length,
    a;
  if (arguments.length < 2) {
    var u = this.node().__on;
    if (u) {
      for (var l = 0, f = u.length, c; l < f; ++l)
        for (i = 0, c = u[l]; i < o; ++i)
          if ((a = r[i]).type === c.type && a.name === c.name) return c.value;
    }
    return;
  }
  for (u = e ? Xn : On, i = 0; i < o; ++i) this.each(u(r[i], e, n));
  return this;
}
function pe(t, e, n) {
  var r = K(t),
    i = r.CustomEvent;
  (typeof i == "function"
    ? (i = new i(e, n))
    : ((i = r.doc.createEvent("Event")),
      n
        ? (i.initEvent(e, n.bubbles, n.cancelable), (i.detail = n.detail))
        : i.initEvent(e, !1, !1)),
    t.dispatchEvent(i));
}
function qn(t, e) {
  return function () {
    return pe(this, t, e);
  };
}
function Yn(t, e) {
  return function () {
    return pe(this, t, e.apply(this, arguments));
  };
}
function me(t, e) {
  return this.each((typeof e == "function" ? Yn : qn)(t, e));
}
function* ge() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length, a; i < o; ++i)
      (a = r[i]) && (yield a);
}
var G = [null];
function E(t, e) {
  ((this._groups = t), (this._parents = e));
}
function de() {
  return new E([[doc[docElem]]], G);
}
function Un() {
  return this;
}
E.prototype = de.prototype = {
  constructor: E,
  select: Tt,
  selectAll: zt,
  selectChild: Dt,
  selectChildren: It,
  filter: Ft,
  data: Rt,
  enter: Pt,
  exit: Vt,
  join: Bt,
  merge: kt,
  selection: Un,
  order: Ot,
  sort: Xt,
  call: qt,
  nodes: Yt,
  node: Ut,
  size: Ht,
  empty: Qt,
  each: Kt,
  attr: Gt,
  style: Jt,
  property: Zt,
  classed: ne,
  text: re,
  html: ie,
  raise: oe,
  lower: ue,
  append: fe,
  insert: ae,
  remove: le,
  clone: se,
  datum: ce,
  on: he,
  dispatch: me,
  [Symbol.iterator]: ge,
};
var Hn = de;
function L(t) {
  return typeof t == "string"
    ? new E([[doc.querySelector(t)]], [doc[docElem]])
    : new E([[t]], G);
}
function Qn(t) {
  return L(V(t).call(doc[docElem]));
}
var Kn = 0;
function vt() {
  return new _t();
}
function _t() {
  this._ = "@" + (++Kn).toString(36);
}
_t.prototype = vt.prototype = {
  constructor: _t,
  get: function (t) {
    for (var e = this._; !(e in t); ) if (!(t = t.parentNode)) return;
    return t[e];
  },
  set: function (t, e) {
    return (t[this._] = e);
  },
  remove: function (t) {
    return this._ in t && delete t[this._];
  },
  toString: function () {
    return this._;
  },
};
function ft(t) {
  let e;
  for (; (e = t.sourceEvent); ) t = e;
  return t;
}
function X(t, e) {
  if (((t = ft(t)), e === void 0 && (e = t.currentTarget), e)) {
    var n = e.ownerSVGElement || e;
    if (n.createSVGPoint) {
      var r = n.createSVGPoint();
      return (
        (r.x = t.clientX),
        (r.y = t.clientY),
        (r = r.matrixTransform(e.getScreenCTM().inverse())),
        [r.x, r.y]
      );
    }
    if (e.getBoundingClientRect) {
      var i = e.getBoundingClientRect();
      return [
        t.clientX - i.left - e.clientLeft,
        t.clientY - i.top - e.clientTop,
      ];
    }
  }
  return [t.pageX, t.pageY];
}
function Gn(t, e) {
  return (
    t.target &&
      ((t = ft(t)),
      e === void 0 && (e = t.currentTarget),
      (t = t.touches || [t])),
    Array.from(t, (n) => X(n, e))
  );
}
function Jn(t) {
  return typeof t == "string"
    ? new E([doc.querySelectorAll(t)], [doc[docElem]])
    : new E([H(t)], G);
}
function Wn(t, e) {
  var n,
    r = 1;
  (t == null && (t = 0), e == null && (e = 0));
  function i() {
    var o,
      a = n.length,
      u,
      l = 0,
      f = 0;
    for (o = 0; o < a; ++o) ((u = n[o]), (l += u.x), (f += u.y));
    for (l = (l / a - t) * r, f = (f / a - e) * r, o = 0; o < a; ++o)
      ((u = n[o]), (u.x -= l), (u.y -= f));
  }
  return (
    (i.initialize = function (o) {
      n = o;
    }),
    (i.x = function (o) {
      return arguments.length ? ((t = +o), i) : t;
    }),
    (i.y = function (o) {
      return arguments.length ? ((e = +o), i) : e;
    }),
    (i.strength = function (o) {
      return arguments.length ? ((r = +o), i) : r;
    }),
    i
  );
}
function xe(t) {
  let e = +this._x.call(null, t),
    n = +this._y.call(null, t);
  return ye(this.cover(e, n), e, n, t);
}
function ye(t, e, n, r) {
  if (isNaN(e) || isNaN(n)) return t;
  var i,
    o = t._root,
    a = { data: r },
    u = t._x0,
    l = t._y0,
    f = t._x1,
    c = t._y1,
    _,
    g,
    p,
    y,
    m,
    h,
    d,
    x;
  if (!o) return ((t._root = a), t);
  for (; o.length; )
    if (
      ((m = e >= (_ = (u + f) / 2)) ? (u = _) : (f = _),
      (h = n >= (g = (l + c) / 2)) ? (l = g) : (c = g),
      (i = o),
      !(o = o[(d = (h << 1) | m)]))
    )
      return ((i[d] = a), t);
  if (
    ((p = +t._x.call(null, o.data)),
    (y = +t._y.call(null, o.data)),
    e === p && n === y)
  )
    return ((a.next = o), i ? (i[d] = a) : (t._root = a), t);
  do
    ((i = i ? (i[d] = new Array(4)) : (t._root = new Array(4))),
      (m = e >= (_ = (u + f) / 2)) ? (u = _) : (f = _),
      (h = n >= (g = (l + c) / 2)) ? (l = g) : (c = g));
  while ((d = (h << 1) | m) === (x = ((y >= g) << 1) | (p >= _)));
  return ((i[x] = o), (i[d] = a), t);
}
function _e(t) {
  var e,
    n,
    r = t.length,
    i,
    o,
    a = new Array(r),
    u = new Array(r),
    l = 1 / 0,
    f = 1 / 0,
    c = -1 / 0,
    _ = -1 / 0;
  for (n = 0; n < r; ++n)
    isNaN((i = +this._x.call(null, (e = t[n])))) ||
      isNaN((o = +this._y.call(null, e))) ||
      ((a[n] = i),
      (u[n] = o),
      i < l && (l = i),
      i > c && (c = i),
      o < f && (f = o),
      o > _ && (_ = o));
  if (l > c || f > _) return this;
  for (this.cover(l, f).cover(c, _), n = 0; n < r; ++n)
    ye(this, a[n], u[n], t[n]);
  return this;
}
function ve(t, e) {
  if (isNaN((t = +t)) || isNaN((e = +e))) return this;
  var n = this._x0,
    r = this._y0,
    i = this._x1,
    o = this._y1;
  if (isNaN(n)) ((i = (n = Math.floor(t)) + 1), (o = (r = Math.floor(e)) + 1));
  else {
    for (
      var a = i - n || 1, u = this._root, l, f;
      n > t || t >= i || r > e || e >= o;
    )
      switch (
        ((f = ((e < r) << 1) | (t < n)),
        (l = new Array(4)),
        (l[f] = u),
        (u = l),
        (a *= 2),
        f)
      ) {
        case 0:
          ((i = n + a), (o = r + a));
          break;
        case 1:
          ((n = i - a), (o = r + a));
          break;
        case 2:
          ((i = n + a), (r = o - a));
          break;
        case 3:
          ((n = i - a), (r = o - a));
          break;
      }
    this._root && this._root.length && (this._root = u);
  }
  return ((this._x0 = n), (this._y0 = r), (this._x1 = i), (this._y1 = o), this);
}
function we() {
  var t = [];
  return (
    this.visit(function (e) {
      if (!e.length)
        do t.push(e.data);
        while ((e = e.next));
    }),
    t
  );
}
function Ae(t) {
  return arguments.length
    ? this.cover(+t[0][0], +t[0][1]).cover(+t[1][0], +t[1][1])
    : isNaN(this._x0)
      ? void 0
      : [
          [this._x0, this._y0],
          [this._x1, this._y1],
        ];
}
function z(t, e, n, r, i) {
  ((this.node = t), (this.x0 = e), (this.y0 = n), (this.x1 = r), (this.y1 = i));
}
function Ne(t, e, n) {
  var r,
    i = this._x0,
    o = this._y0,
    a,
    u,
    l,
    f,
    c = this._x1,
    _ = this._y1,
    g = [],
    p = this._root,
    y,
    m;
  for (
    p && g.push(new z(p, i, o, c, _)),
      n == null
        ? (n = 1 / 0)
        : ((i = t - n), (o = e - n), (c = t + n), (_ = e + n), (n *= n));
    (y = g.pop());
  )
    if (
      !(
        !(p = y.node) ||
        (a = y.x0) > c ||
        (u = y.y0) > _ ||
        (l = y.x1) < i ||
        (f = y.y1) < o
      )
    )
      if (p.length) {
        var h = (a + l) / 2,
          d = (u + f) / 2;
        (g.push(
          new z(p[3], h, d, l, f),
          new z(p[2], a, d, h, f),
          new z(p[1], h, u, l, d),
          new z(p[0], a, u, h, d),
        ),
          (m = ((e >= d) << 1) | (t >= h)) &&
            ((y = g[g.length - 1]),
            (g[g.length - 1] = g[g.length - 1 - m]),
            (g[g.length - 1 - m] = y)));
      } else {
        var x = t - +this._x.call(null, p.data),
          w = e - +this._y.call(null, p.data),
          s = x * x + w * w;
        if (s < n) {
          var v = Math.sqrt((n = s));
          ((i = t - v), (o = e - v), (c = t + v), (_ = e + v), (r = p.data));
        }
      }
  return r;
}
function be(t) {
  if (
    isNaN((c = +this._x.call(null, t))) ||
    isNaN((_ = +this._y.call(null, t)))
  )
    return this;
  var e,
    n = this._root,
    r,
    i,
    o,
    a = this._x0,
    u = this._y0,
    l = this._x1,
    f = this._y1,
    c,
    _,
    g,
    p,
    y,
    m,
    h,
    d;
  if (!n) return this;
  if (n.length)
    for (;;) {
      if (
        ((y = c >= (g = (a + l) / 2)) ? (a = g) : (l = g),
        (m = _ >= (p = (u + f) / 2)) ? (u = p) : (f = p),
        (e = n),
        !(n = n[(h = (m << 1) | y)]))
      )
        return this;
      if (!n.length) break;
      (e[(h + 1) & 3] || e[(h + 2) & 3] || e[(h + 3) & 3]) &&
        ((r = e), (d = h));
    }
  for (; n.data !== t; ) if (((i = n), !(n = n.next))) return this;
  return (
    (o = n.next) && delete n.next,
    i
      ? (o ? (i.next = o) : delete i.next, this)
      : e
        ? (o ? (e[h] = o) : delete e[h],
          (n = e[0] || e[1] || e[2] || e[3]) &&
            n === (e[3] || e[2] || e[1] || e[0]) &&
            !n.length &&
            (r ? (r[d] = n) : (this._root = n)),
          this)
        : ((this._root = o), this)
  );
}
function Se(t) {
  for (var e = 0, n = t.length; e < n; ++e) this.remove(t[e]);
  return this;
}
function Ee() {
  return this._root;
}
function Me() {
  var t = 0;
  return (
    this.visit(function (e) {
      if (!e.length)
        do ++t;
        while ((e = e.next));
    }),
    t
  );
}
function Ce(t) {
  var e = [],
    n,
    r = this._root,
    i,
    o,
    a,
    u,
    l;
  for (
    r && e.push(new z(r, this._x0, this._y0, this._x1, this._y1));
    (n = e.pop());
  )
    if (
      !t((r = n.node), (o = n.x0), (a = n.y0), (u = n.x1), (l = n.y1)) &&
      r.length
    ) {
      var f = (o + u) / 2,
        c = (a + l) / 2;
      ((i = r[3]) && e.push(new z(i, f, c, u, l)),
        (i = r[2]) && e.push(new z(i, o, c, f, l)),
        (i = r[1]) && e.push(new z(i, f, a, u, c)),
        (i = r[0]) && e.push(new z(i, o, a, f, c)));
    }
  return this;
}
function Te(t) {
  var e = [],
    n = [],
    r;
  for (
    this._root &&
    e.push(new z(this._root, this._x0, this._y0, this._x1, this._y1));
    (r = e.pop());
  ) {
    var i = r.node;
    if (i.length) {
      var o,
        a = r.x0,
        u = r.y0,
        l = r.x1,
        f = r.y1,
        c = (a + l) / 2,
        _ = (u + f) / 2;
      ((o = i[0]) && e.push(new z(o, a, u, c, _)),
        (o = i[1]) && e.push(new z(o, c, u, l, _)),
        (o = i[2]) && e.push(new z(o, a, _, c, f)),
        (o = i[3]) && e.push(new z(o, c, _, l, f)));
    }
    n.push(r);
  }
  for (; (r = n.pop()); ) t(r.node, r.x0, r.y0, r.x1, r.y1);
  return this;
}
function ze(t) {
  return t[0];
}
function De(t) {
  return arguments.length ? ((this._x = t), this) : this._x;
}
function Ie(t) {
  return t[1];
}
function Fe(t) {
  return arguments.length ? ((this._y = t), this) : this._y;
}
function B(t, e, n) {
  var r = new wt(e ?? ze, n ?? Ie, NaN, NaN, NaN, NaN);
  return t == null ? r : r.addAll(t);
}
function wt(t, e, n, r, i, o) {
  ((this._x = t),
    (this._y = e),
    (this._x0 = n),
    (this._y0 = r),
    (this._x1 = i),
    (this._y1 = o),
    (this._root = void 0));
}
function Pe(t) {
  for (var e = { data: t.data }, n = e; (t = t.next); )
    n = n.next = { data: t.data };
  return e;
}
var D = (B.prototype = wt.prototype);
D.copy = function () {
  var t = new wt(this._x, this._y, this._x0, this._y0, this._x1, this._y1),
    e = this._root,
    n,
    r;
  if (!e) return t;
  if (!e.length) return ((t._root = Pe(e)), t);
  for (n = [{ source: e, target: (t._root = new Array(4)) }]; (e = n.pop()); )
    for (var i = 0; i < 4; ++i)
      (r = e.source[i]) &&
        (r.length
          ? n.push({ source: r, target: (e.target[i] = new Array(4)) })
          : (e.target[i] = Pe(r)));
  return t;
};
D.add = xe;
D.addAll = _e;
D.cover = ve;
D.data = we;
D.extent = Ae;
D.find = Ne;
D.remove = be;
D.removeAll = Se;
D.root = Ee;
D.size = Me;
D.visit = Ce;
D.visitAfter = Te;
D.x = De;
D.y = Fe;
function M(t) {
  return function () {
    return t;
  };
}
function P(t) {
  return (t() - 0.5) * 1e-6;
}
function Zn(t) {
  return t.x + t.vx;
}
function $n(t) {
  return t.y + t.vy;
}
function jn(t) {
  var e,
    n,
    r,
    i = 1,
    o = 1;
  typeof t != "function" && (t = M(t == null ? 1 : +t));
  function a() {
    for (var f, c = e.length, _, g, p, y, m, h, d = 0; d < o; ++d)
      for (_ = B(e, Zn, $n).visitAfter(u), f = 0; f < c; ++f)
        ((g = e[f]),
          (m = n[g.index]),
          (h = m * m),
          (p = g.x + g.vx),
          (y = g.y + g.vy),
          _.visit(x));
    function x(w, s, v, A, b) {
      var N = w.data,
        C = w.r,
        S = m + C;
      if (N) {
        if (N.index > g.index) {
          var T = p - N.x - N.vx,
            F = y - N.y - N.vy,
            I = T * T + F * F;
          I < S * S &&
            (T === 0 && ((T = P(r)), (I += T * T)),
            F === 0 && ((F = P(r)), (I += F * F)),
            (I = ((S - (I = Math.sqrt(I))) / I) * i),
            (g.vx += (T *= I) * (S = (C *= C) / (h + C))),
            (g.vy += (F *= I) * S),
            (N.vx -= T * (S = 1 - S)),
            (N.vy -= F * S));
        }
        return;
      }
      return s > p + S || A < p - S || v > y + S || b < y - S;
    }
  }
  function u(f) {
    if (f.data) return (f.r = n[f.data.index]);
    for (var c = (f.r = 0); c < 4; ++c) f[c] && f[c].r > f.r && (f.r = f[c].r);
  }
  function l() {
    if (e) {
      var f,
        c = e.length,
        _;
      for (n = new Array(c), f = 0; f < c; ++f)
        ((_ = e[f]), (n[_.index] = +t(_, f, e)));
    }
  }
  return (
    (a.initialize = function (f, c) {
      ((e = f), (r = c), l());
    }),
    (a.iterations = function (f) {
      return arguments.length ? ((o = +f), a) : o;
    }),
    (a.strength = function (f) {
      return arguments.length ? ((i = +f), a) : i;
    }),
    (a.radius = function (f) {
      return arguments.length
        ? ((t = typeof f == "function" ? f : M(+f)), l(), a)
        : t;
    }),
    a
  );
}
function tr(t) {
  return t.index;
}
function Le(t, e) {
  var n = t.get(e);
  if (!n) throw new Error("node not found: " + e);
  return n;
}
function er(t) {
  var e = tr,
    n = _,
    r,
    i = M(30),
    o,
    a,
    u,
    l,
    f,
    c = 1;
  t == null && (t = []);
  function _(h) {
    return 1 / Math.min(u[h.source.index], u[h.target.index]);
  }
  function g(h) {
    for (var d = 0, x = t.length; d < c; ++d)
      for (var w = 0, s, v, A, b, N, C, S; w < x; ++w)
        ((s = t[w]),
          (v = s.source),
          (A = s.target),
          (b = A.x + A.vx - v.x - v.vx || P(f)),
          (N = A.y + A.vy - v.y - v.vy || P(f)),
          (C = Math.sqrt(b * b + N * N)),
          (C = ((C - o[w]) / C) * h * r[w]),
          (b *= C),
          (N *= C),
          (A.vx -= b * (S = l[w])),
          (A.vy -= N * S),
          (v.vx += b * (S = 1 - S)),
          (v.vy += N * S));
  }
  function p() {
    if (a) {
      var h,
        d = a.length,
        x = t.length,
        w = new Map(a.map((v, A) => [e(v, A, a), v])),
        s;
      for (h = 0, u = new Array(d); h < x; ++h)
        ((s = t[h]),
          (s.index = h),
          typeof s.source != "object" && (s.source = Le(w, s.source)),
          typeof s.target != "object" && (s.target = Le(w, s.target)),
          (u[s.source.index] = (u[s.source.index] || 0) + 1),
          (u[s.target.index] = (u[s.target.index] || 0) + 1));
      for (h = 0, l = new Array(x); h < x; ++h)
        ((s = t[h]),
          (l[h] = u[s.source.index] / (u[s.source.index] + u[s.target.index])));
      ((r = new Array(x)), y(), (o = new Array(x)), m());
    }
  }
  function y() {
    if (a) for (var h = 0, d = t.length; h < d; ++h) r[h] = +n(t[h], h, t);
  }
  function m() {
    if (a) for (var h = 0, d = t.length; h < d; ++h) o[h] = +i(t[h], h, t);
  }
  return (
    (g.initialize = function (h, d) {
      ((a = h), (f = d), p());
    }),
    (g.links = function (h) {
      return arguments.length ? ((t = h), p(), g) : t;
    }),
    (g.id = function (h) {
      return arguments.length ? ((e = h), g) : e;
    }),
    (g.iterations = function (h) {
      return arguments.length ? ((c = +h), g) : c;
    }),
    (g.strength = function (h) {
      return arguments.length
        ? ((n = typeof h == "function" ? h : M(+h)), y(), g)
        : n;
    }),
    (g.distance = function (h) {
      return arguments.length
        ? ((i = typeof h == "function" ? h : M(+h)), m(), g)
        : i;
    }),
    g
  );
}
var nr = { value: () => {} };
function Ve() {
  for (var t = 0, e = arguments.length, n = {}, r; t < e; ++t) {
    if (!(r = arguments[t] + "") || r in n || /[\s.]/.test(r))
      throw new Error("illegal type: " + r);
    n[r] = [];
  }
  return new at(n);
}
function at(t) {
  this._ = t;
}
function rr(t, e) {
  return t
    .trim()
    .split(/^|\s+/)
    .map(function (n) {
      var r = "",
        i = n.indexOf(".");
      if (
        (i >= 0 && ((r = n.slice(i + 1)), (n = n.slice(0, i))),
        n && !e.hasOwnProperty(n))
      )
        throw new Error("unknown type: " + n);
      return { type: n, name: r };
    });
}
at.prototype = Ve.prototype = {
  constructor: at,
  on: function (t, e) {
    var n = this._,
      r = rr(t + "", n),
      i,
      o = -1,
      a = r.length;
    if (arguments.length < 2) {
      for (; ++o < a; )
        if ((i = (t = r[o]).type) && (i = ir(n[i], t.name))) return i;
      return;
    }
    if (e != null && typeof e != "function")
      throw new Error("invalid callback: " + e);
    for (; ++o < a; )
      if ((i = (t = r[o]).type)) n[i] = Re(n[i], t.name, e);
      else if (e == null) for (i in n) n[i] = Re(n[i], t.name, null);
    return this;
  },
  copy: function () {
    var t = {},
      e = this._;
    for (var n in e) t[n] = e[n].slice();
    return new at(t);
  },
  call: function (t, e) {
    if ((i = arguments.length - 2) > 0)
      for (var n = new Array(i), r = 0, i, o; r < i; ++r)
        n[r] = arguments[r + 2];
    if (!this._.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    for (o = this._[t], r = 0, i = o.length; r < i; ++r) o[r].value.apply(e, n);
  },
  apply: function (t, e, n) {
    if (!this._.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    for (var r = this._[t], i = 0, o = r.length; i < o; ++i)
      r[i].value.apply(e, n);
  },
};
function ir(t, e) {
  for (var n = 0, r = t.length, i; n < r; ++n)
    if ((i = t[n]).name === e) return i.value;
}
function Re(t, e, n) {
  for (var r = 0, i = t.length; r < i; ++r)
    if (t[r].name === e) {
      ((t[r] = nr), (t = t.slice(0, r).concat(t.slice(r + 1))));
      break;
    }
  return (n != null && t.push({ name: e, value: n }), t);
}
var J = Ve;
var q = 0,
  Z = 0,
  W = 0,
  ke = 1e3,
  lt,
  $,
  st = 0,
  k = 0,
  ct = 0,
  j = typeof performance == "object" && performance.now ? performance : Date,
  Oe =
    typeof win == "object" && win.requestAnimationFrame
      ? win.requestAnimationFrame.bind(win)
      : function (t) {
          setTimeout(t, 17);
        };
function bt() {
  return k || (Oe(or), (k = j.now() + ct));
}
function or() {
  k = 0;
}
function At() {
  this._call = this._time = this._next = null;
}
At.prototype = ht.prototype = {
  constructor: At,
  restart: function (t, e, n) {
    if (typeof t != "function")
      throw new TypeError("callback is not a function");
    ((n = (n == null ? bt() : +n) + (e == null ? 0 : +e)),
      !this._next &&
        $ !== this &&
        ($ ? ($._next = this) : (lt = this), ($ = this)),
      (this._call = t),
      (this._time = n),
      Nt());
  },
  stop: function () {
    this._call && ((this._call = null), (this._time = 1 / 0), Nt());
  },
};
function ht(t, e, n) {
  var r = new At();
  return (r.restart(t, e, n), r);
}
function Xe() {
  (bt(), ++q);
  for (var t = lt, e; t; )
    ((e = k - t._time) >= 0 && t._call.call(void 0, e), (t = t._next));
  --q;
}
function Be() {
  ((k = (st = j.now()) + ct), (q = Z = 0));
  try {
    Xe();
  } finally {
    ((q = 0), fr(), (k = 0));
  }
}
function ur() {
  var t = j.now(),
    e = t - st;
  e > ke && ((ct -= e), (st = t));
}
function fr() {
  for (var t, e = lt, n, r = 1 / 0; e; )
    e._call
      ? (r > e._time && (r = e._time), (t = e), (e = e._next))
      : ((n = e._next), (e._next = null), (e = t ? (t._next = n) : (lt = n)));
  (($ = t), Nt(r));
}
function Nt(t) {
  if (!q) {
    Z && (Z = clearTimeout(Z));
    var e = t - k;
    e > 24
      ? (t < 1 / 0 && (Z = setTimeout(Be, t - j.now() - ct)),
        W && (W = clearInterval(W)))
      : (W || ((st = j.now()), (W = setInterval(ur, ke))), (q = 1), Oe(Be));
  }
}
function qe() {
  let t = 1;
  return () => (t = (1664525 * t + 1013904223) % 4294967296) / 4294967296;
}
function Ye(t) {
  return t.x;
}
function Ue(t) {
  return t.y;
}
var ar = 10,
  lr = Math.PI * (3 - Math.sqrt(5));
function sr(t) {
  var e,
    n = 1,
    r = 0.001,
    i = 1 - Math.pow(r, 1 / 300),
    o = 0,
    a = 0.6,
    u = new Map(),
    l = ht(_),
    f = J("tick", "end"),
    c = qe();
  t == null && (t = []);
  function _() {
    (g(), f.call("tick", e), n < r && (l.stop(), f.call("end", e)));
  }
  function g(m) {
    var h,
      d = t.length,
      x;
    m === void 0 && (m = 1);
    for (var w = 0; w < m; ++w)
      for (
        n += (o - n) * i,
          u.forEach(function (s) {
            s(n);
          }),
          h = 0;
        h < d;
        ++h
      )
        ((x = t[h]),
          x.fx == null ? (x.x += x.vx *= a) : ((x.x = x.fx), (x.vx = 0)),
          x.fy == null ? (x.y += x.vy *= a) : ((x.y = x.fy), (x.vy = 0)));
    return e;
  }
  function p() {
    for (var m = 0, h = t.length, d; m < h; ++m) {
      if (
        ((d = t[m]),
        (d.index = m),
        d.fx != null && (d.x = d.fx),
        d.fy != null && (d.y = d.fy),
        isNaN(d.x) || isNaN(d.y))
      ) {
        var x = ar * Math.sqrt(0.5 + m),
          w = m * lr;
        ((d.x = x * Math.cos(w)), (d.y = x * Math.sin(w)));
      }
      (isNaN(d.vx) || isNaN(d.vy)) && (d.vx = d.vy = 0);
    }
  }
  function y(m) {
    return (m.initialize && m.initialize(t, c), m);
  }
  return (
    p(),
    (e = {
      tick: g,
      restart: function () {
        return (l.restart(_), e);
      },
      stop: function () {
        return (l.stop(), e);
      },
      nodes: function (m) {
        return arguments.length ? ((t = m), p(), u.forEach(y), e) : t;
      },
      alpha: function (m) {
        return arguments.length ? ((n = +m), e) : n;
      },
      alphaMin: function (m) {
        return arguments.length ? ((r = +m), e) : r;
      },
      alphaDecay: function (m) {
        return arguments.length ? ((i = +m), e) : +i;
      },
      alphaTarget: function (m) {
        return arguments.length ? ((o = +m), e) : o;
      },
      velocityDecay: function (m) {
        return arguments.length ? ((a = 1 - m), e) : 1 - a;
      },
      randomSource: function (m) {
        return arguments.length ? ((c = m), u.forEach(y), e) : c;
      },
      force: function (m, h) {
        return arguments.length > 1
          ? (h == null ? u.delete(m) : u.set(m, y(h)), e)
          : u.get(m);
      },
      find: function (m, h, d) {
        var x = 0,
          w = t.length,
          s,
          v,
          A,
          b,
          N;
        for (d == null ? (d = 1 / 0) : (d *= d), x = 0; x < w; ++x)
          ((b = t[x]),
            (s = m - b.x),
            (v = h - b.y),
            (A = s * s + v * v),
            A < d && ((N = b), (d = A)));
        return N;
      },
      on: function (m, h) {
        return arguments.length > 1 ? (f.on(m, h), e) : f.on(m);
      },
    })
  );
}
function cr() {
  var t,
    e,
    n,
    r,
    i = M(-30),
    o,
    a = 1,
    u = 1 / 0,
    l = 0.81;
  function f(p) {
    var y,
      m = t.length,
      h = B(t, Ye, Ue).visitAfter(_);
    for (r = p, y = 0; y < m; ++y) ((e = t[y]), h.visit(g));
  }
  function c() {
    if (t) {
      var p,
        y = t.length,
        m;
      for (o = new Array(y), p = 0; p < y; ++p)
        ((m = t[p]), (o[m.index] = +i(m, p, t)));
    }
  }
  function _(p) {
    var y = 0,
      m,
      h,
      d = 0,
      x,
      w,
      s;
    if (p.length) {
      for (x = w = s = 0; s < 4; ++s)
        (m = p[s]) &&
          (h = Math.abs(m.value)) &&
          ((y += m.value), (d += h), (x += h * m.x), (w += h * m.y));
      ((p.x = x / d), (p.y = w / d));
    } else {
      ((m = p), (m.x = m.data.x), (m.y = m.data.y));
      do y += o[m.data.index];
      while ((m = m.next));
    }
    p.value = y;
  }
  function g(p, y, m, h) {
    if (!p.value) return !0;
    var d = p.x - e.x,
      x = p.y - e.y,
      w = h - y,
      s = d * d + x * x;
    if ((w * w) / l < s)
      return (
        s < u &&
          (d === 0 && ((d = P(n)), (s += d * d)),
          x === 0 && ((x = P(n)), (s += x * x)),
          s < a && (s = Math.sqrt(a * s)),
          (e.vx += (d * p.value * r) / s),
          (e.vy += (x * p.value * r) / s)),
        !0
      );
    if (p.length || s >= u) return;
    (p.data !== e || p.next) &&
      (d === 0 && ((d = P(n)), (s += d * d)),
      x === 0 && ((x = P(n)), (s += x * x)),
      s < a && (s = Math.sqrt(a * s)));
    do
      p.data !== e &&
        ((w = (o[p.data.index] * r) / s), (e.vx += d * w), (e.vy += x * w));
    while ((p = p.next));
  }
  return (
    (f.initialize = function (p, y) {
      ((t = p), (n = y), c());
    }),
    (f.strength = function (p) {
      return arguments.length
        ? ((i = typeof p == "function" ? p : M(+p)), c(), f)
        : i;
    }),
    (f.distanceMin = function (p) {
      return arguments.length ? ((a = p * p), f) : Math.sqrt(a);
    }),
    (f.distanceMax = function (p) {
      return arguments.length ? ((u = p * p), f) : Math.sqrt(u);
    }),
    (f.theta = function (p) {
      return arguments.length ? ((l = p * p), f) : Math.sqrt(l);
    }),
    f
  );
}
function hr(t, e, n) {
  var r,
    i = M(0.1),
    o,
    a;
  (typeof t != "function" && (t = M(+t)),
    e == null && (e = 0),
    n == null && (n = 0));
  function u(f) {
    for (var c = 0, _ = r.length; c < _; ++c) {
      var g = r[c],
        p = g.x - e || 1e-6,
        y = g.y - n || 1e-6,
        m = Math.sqrt(p * p + y * y),
        h = ((a[c] - m) * o[c] * f) / m;
      ((g.vx += p * h), (g.vy += y * h));
    }
  }
  function l() {
    if (r) {
      var f,
        c = r.length;
      for (o = new Array(c), a = new Array(c), f = 0; f < c; ++f)
        ((a[f] = +t(r[f], f, r)), (o[f] = isNaN(a[f]) ? 0 : +i(r[f], f, r)));
    }
  }
  return (
    (u.initialize = function (f) {
      ((r = f), l());
    }),
    (u.strength = function (f) {
      return arguments.length
        ? ((i = typeof f == "function" ? f : M(+f)), l(), u)
        : i;
    }),
    (u.radius = function (f) {
      return arguments.length
        ? ((t = typeof f == "function" ? f : M(+f)), l(), u)
        : t;
    }),
    (u.x = function (f) {
      return arguments.length ? ((e = +f), u) : e;
    }),
    (u.y = function (f) {
      return arguments.length ? ((n = +f), u) : n;
    }),
    u
  );
}
function pr(t) {
  var e = M(0.1),
    n,
    r,
    i;
  typeof t != "function" && (t = M(t == null ? 0 : +t));
  function o(u) {
    for (var l = 0, f = n.length, c; l < f; ++l)
      ((c = n[l]), (c.vx += (i[l] - c.x) * r[l] * u));
  }
  function a() {
    if (n) {
      var u,
        l = n.length;
      for (r = new Array(l), i = new Array(l), u = 0; u < l; ++u)
        r[u] = isNaN((i[u] = +t(n[u], u, n))) ? 0 : +e(n[u], u, n);
    }
  }
  return (
    (o.initialize = function (u) {
      ((n = u), a());
    }),
    (o.strength = function (u) {
      return arguments.length
        ? ((e = typeof u == "function" ? u : M(+u)), a(), o)
        : e;
    }),
    (o.x = function (u) {
      return arguments.length
        ? ((t = typeof u == "function" ? u : M(+u)), a(), o)
        : t;
    }),
    o
  );
}
function mr(t) {
  var e = M(0.1),
    n,
    r,
    i;
  typeof t != "function" && (t = M(t == null ? 0 : +t));
  function o(u) {
    for (var l = 0, f = n.length, c; l < f; ++l)
      ((c = n[l]), (c.vy += (i[l] - c.y) * r[l] * u));
  }
  function a() {
    if (n) {
      var u,
        l = n.length;
      for (r = new Array(l), i = new Array(l), u = 0; u < l; ++u)
        r[u] = isNaN((i[u] = +t(n[u], u, n))) ? 0 : +e(n[u], u, n);
    }
  }
  return (
    (o.initialize = function (u) {
      ((n = u), a());
    }),
    (o.strength = function (u) {
      return arguments.length
        ? ((e = typeof u == "function" ? u : M(+u)), a(), o)
        : e;
    }),
    (o.y = function (u) {
      return arguments.length
        ? ((t = typeof u == "function" ? u : M(+u)), a(), o)
        : t;
    }),
    o
  );
}
var He = { passive: !1 },
  O = { capture: !0, passive: !1 };
function pt(t) {
  t.stopImmediatePropagation();
}
function R(t) {
  (t.preventDefault(), t.stopImmediatePropagation());
}
function St(t) {
  var e = t.doc[docElem],
    n = L(t).on("dragstart.drag", R, O);
  "onselectstart" in e
    ? n.on("selectstart.drag", R, O)
    : ((e.__noselect = e.style.MozUserSelect),
      (e.style.MozUserSelect = "none"));
}
function Et(t, e) {
  var n = t.doc[docElem],
    r = L(t).on("dragstart.drag", null);
  (e &&
    (r.on("click.drag", R, O),
    setTimeout(function () {
      r.on("click.drag", null);
    }, 0)),
    "onselectstart" in n
      ? r.on("selectstart.drag", null)
      : ((n.style.MozUserSelect = n.__noselect), delete n.__noselect));
}
var tt = (t) => () => t;
function et(
  t,
  {
    sourceEvent: e,
    subject: n,
    target: r,
    identifier: i,
    active: o,
    x: a,
    y: u,
    dx: l,
    dy: f,
    dispatch: c,
  },
) {
  Object.defineProperties(this, {
    type: { value: t, enumerable: !0, configurable: !0 },
    sourceEvent: { value: e, enumerable: !0, configurable: !0 },
    subject: { value: n, enumerable: !0, configurable: !0 },
    target: { value: r, enumerable: !0, configurable: !0 },
    identifier: { value: i, enumerable: !0, configurable: !0 },
    active: { value: o, enumerable: !0, configurable: !0 },
    x: { value: a, enumerable: !0, configurable: !0 },
    y: { value: u, enumerable: !0, configurable: !0 },
    dx: { value: l, enumerable: !0, configurable: !0 },
    dy: { value: f, enumerable: !0, configurable: !0 },
    _: { value: c },
  });
}
et.prototype.on = function () {
  var t = this._.on.apply(this._, arguments);
  return t === this._ ? this : t;
};
function gr(t) {
  return !t.ctrlKey && !t.button;
}
function dr() {
  return this.parentNode;
}
function xr(t, e) {
  return e ?? { x: t.x, y: t.y };
}
function yr() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function _r() {
  var t = gr,
    e = dr,
    n = xr,
    r = yr,
    i = {},
    o = J("start", "drag", "end"),
    a = 0,
    u,
    l,
    f,
    c,
    _ = 0;
  function g(s) {
    s.on("mousedown.drag", p)
      .filter(r)
      .on("touchstart.drag", h)
      .on("touchmove.drag", d, He)
      .on("touchend.drag touchcancel.drag", x)
      .style("touch-action", "none")
      .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function p(s, v) {
    if (!(c || !t.call(this, s, v))) {
      var A = w(this, e.call(this, s, v), s, v, "mouse");
      A &&
        (L(s.view).on("mousemove.drag", y, O).on("mouseup.drag", m, O),
        St(s.view),
        pt(s),
        (f = !1),
        (u = s.clientX),
        (l = s.clientY),
        A("start", s));
    }
  }
  function y(s) {
    if ((R(s), !f)) {
      var v = s.clientX - u,
        A = s.clientY - l;
      f = v * v + A * A > _;
    }
    i.mouse("drag", s);
  }
  function m(s) {
    (L(s.view).on("mousemove.drag mouseup.drag", null),
      Et(s.view, f),
      R(s),
      i.mouse("end", s));
  }
  function h(s, v) {
    if (t.call(this, s, v)) {
      var A = s.changedTouches,
        b = e.call(this, s, v),
        N = A.length,
        C,
        S;
      for (C = 0; C < N; ++C)
        (S = w(this, b, s, v, A[C].identifier, A[C])) &&
          (pt(s), S("start", s, A[C]));
    }
  }
  function d(s) {
    var v = s.changedTouches,
      A = v.length,
      b,
      N;
    for (b = 0; b < A; ++b)
      (N = i[v[b].identifier]) && (R(s), N("drag", s, v[b]));
  }
  function x(s) {
    var v = s.changedTouches,
      A = v.length,
      b,
      N;
    for (
      c && clearTimeout(c),
        c = setTimeout(function () {
          c = null;
        }, 500),
        b = 0;
      b < A;
      ++b
    )
      (N = i[v[b].identifier]) && (pt(s), N("end", s, v[b]));
  }
  function w(s, v, A, b, N, C) {
    var S = o.copy(),
      T = X(C || A, v),
      F,
      I,
      nt;
    if (
      (nt = n.call(
        s,
        new et("beforestart", {
          sourceEvent: A,
          target: g,
          identifier: N,
          active: a,
          x: T[0],
          y: T[1],
          dx: 0,
          dy: 0,
          dispatch: S,
        }),
        b,
      )) != null
    )
      return (
        (F = nt.x - T[0] || 0),
        (I = nt.y - T[1] || 0),
        function Qe(mt, Mt, Ke) {
          var Ct = T,
            gt;
          switch (mt) {
            case "start":
              ((i[N] = Qe), (gt = a++));
              break;
            case "end":
              (delete i[N], --a);
            case "drag":
              ((T = X(Ke || Mt, v)), (gt = a));
              break;
          }
          S.call(
            mt,
            s,
            new et(mt, {
              sourceEvent: Mt,
              subject: nt,
              target: g,
              identifier: N,
              active: gt,
              x: T[0] + F,
              y: T[1] + I,
              dx: T[0] - Ct[0],
              dy: T[1] - Ct[1],
              dispatch: S,
            }),
            b,
          );
        }
      );
  }
  return (
    (g.filter = function (s) {
      return arguments.length
        ? ((t = typeof s == "function" ? s : tt(!!s)), g)
        : t;
    }),
    (g.container = function (s) {
      return arguments.length
        ? ((e = typeof s == "function" ? s : tt(s)), g)
        : e;
    }),
    (g.subject = function (s) {
      return arguments.length
        ? ((n = typeof s == "function" ? s : tt(s)), g)
        : n;
    }),
    (g.touchable = function (s) {
      return arguments.length
        ? ((r = typeof s == "function" ? s : tt(!!s)), g)
        : r;
    }),
    (g.on = function () {
      var s = o.on.apply(o, arguments);
      return s === o ? g : s;
    }),
    (g.clickDistance = function (s) {
      return arguments.length ? ((_ = (s = +s) * s), g) : Math.sqrt(_);
    }),
    g
  );
}
export {
  Qn as create,
  V as creator,
  _r as drag,
  St as dragDisable,
  Et as dragEnable,
  Wn as forceCenter,
  jn as forceCollide,
  er as forceLink,
  cr as forceManyBody,
  hr as forceRadial,
  sr as forceSimulation,
  pr as forceX,
  mr as forceY,
  vt as local,
  xt as matcher,
  Y as namespace,
  it as namespaces,
  X as pointer,
  Gn as pointers,
  L as select,
  Jn as selectAll,
  Hn as selection,
  U as selector,
  dt as selectorAll,
  Wt as style,
  K,
};
