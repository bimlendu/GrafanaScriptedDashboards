/*global XMLHttpRequest: false */

var window, document, ARGS, $, jQuery, moment, kbn;
var graphite = window.location.protocol + "//" + window.location.host;

// use defaults for URL arguments
var arg_i    = 'default';
var arg_span = 4;
var arg_from = '6h';
var arg_reg = 'us-east-1a';
var arg_env = 'corp';
var arg_stack = 'ops';

if (!_.isUndefined(ARGS.span)) {
  arg_span = ARGS.span;           // graph width
}
if (!_.isUndefined(ARGS.from)) {
  arg_from = ARGS.from;           // show data from 'x' hours until now
}
if (!_.isUndefined(ARGS.i)) {
  arg_i = ARGS.i;                 // instance name
}
if (!_.isUndefined(ARGS.reg)) {
  arg_reg = ARGS.reg;                 // instance region
}
if (!_.isUndefined(ARGS.env)) {
  arg_env = ARGS.env;                 // instance environment
}
if (!_.isUndefined(ARGS.stack)) {
  arg_stack = ARGS.stack;                 // instance stack
}

// Execute graphite-api /metrics/find query. Returns array of metric last names ( func('test.cpu-*') returns ['cpu-0','cpu-1',..] )
function find_filter_values(query) {
  var search_url = graphite + '/metrics/find/?query=' + query;
  var res = [];
  var req = new XMLHttpRequest();
  req.open('GET', search_url, false);
  req.send(null);
  var obj = JSON.parse(req.responseText);
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (obj[key].hasOwnProperty("text")) {
        res.push(obj[key].text);
      }
    }
  }
  return res;
}

// Return dashboard filter_list. Optionally include 'All'
function get_filter_object(name, query, show_all) {
  show_all = (show_all === undefined) ? true : show_all;
  var arr = find_filter_values(query);
  var opts = [];
  var i;
  for (i in arr) {
    if (arr.hasOwnProperty(i)) {
      opts.push({"text": arr[i], "value": arr[i]});
    }
  }
  if (show_all === true) {
    opts.unshift({"text": "All", "value": '{' + arr.join() + '}'});
  }
  return {
    type: "filter",
    name: name,
    query: query,
    options: opts,
    current: opts[0],
    includeAll: show_all
  };
}

// Execute graphite-api /metrics/expand query. Returns array of metric full names (func('*.cpu-*') returns ['test.cpu-0','test.cpu-1',..] )
function expand_filter_values(query) {
  var search_url = graphite + '/metrics/expand/?query=' + query;
  var req = new XMLHttpRequest();
  req.open('GET', search_url, false);
  req.send(null);
  var obj = JSON.parse(req.responseText);
  if (obj.hasOwnProperty('results')) {
    return obj.results;
  }
  return [];
}

/*
  panel templates
*/

function panel_cpu(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    renderer: "flot",
    y_formats: ["none"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    legend: {show: true},
    percentage: true,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(averageSeries(keepLastValue(" + prefix + "[[instance]].cpu-*.cpu-wait.value,10)),5)" },
      { "target": "aliasByNode(averageSeries(keepLastValue(" + prefix + "[[instance]].cpu-*.cpu-user.value,10)),5)" },
      { "target": "aliasByNode(averageSeries(keepLastValue(" + prefix + "[[instance]].cpu-*.cpu-system.value,10)),5)" },
      { "target": "aliasByNode(averageSeries(keepLastValue(" + prefix + "[[instance]].cpu-*.cpu-steal.value,10)),5)" },
      { "target": "aliasByNode(averageSeries(keepLastValue(" + prefix + "[[instance]].cpu-*.cpu-interrupt.value,10)),5)" },
      { "target": "aliasByNode(averageSeries(keepLastValue(" + prefix + "[[instance]].cpu-*.cpu-nice.value,10)),5)" },
      { "target": "aliasByNode(averageSeries(keepLastValue(" + prefix + "[[instance]].cpu-*.cpu-idle.value,10)),5)" },
      { "target": "aliasByNode(averageSeries(keepLastValue(" + prefix + "[[instance]].cpu-*.cpu-softirq.value,10)),5)" }
    ],
    aliasColors: {
      "cpu-user": "#508642",
      "cpu-system": "#EAB839",
      "cpu-wait": "#890F02",
      "cpu-steal": "#E24D42",
      "cpu-idle": "#6ED0E0",
      "cpu-nice": "#629E51",
      "cpu-irq": "#1F78C1",
      "cpu-intrpt": "#EF843C"
    }
  };
}

function panel_memory(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    stack: true,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].memory.memory-{free,cached,buffered,used}.value,5)" }
    ],
    aliasColors: {
      "memory-free": "#66b266",
      "memory-used": "#ff6666",
      "memory-cached": "#EF843C",
      "memory-buffered": "#CCA300"
    }
  };
}

function panel_loadavg(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["none"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack : true,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].load.load.*,6)" }
    ],
    aliasColors: {
      "midterm": "#629E51",
      "shortterm": "#1F78C1",
      "longterm": "#EF843C"
    }
  };
}

function panel_swap_size(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0, leftMin: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].swap.swap-{free,used,cached}.value,5)" },
    ],
    aliasColors: {
      "swap-used": "#ff6666",
      "swap-cached": "#EAB839",
      "swap-free": "#66b266"
    }
  };
}

function panel_swap_io(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    linewidth: 1,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(movingMedian(nonNegativeDerivative(keepLastValue(" + prefix + "[[instance]].swap.swap_io-in.value,10),0),'5min'),5)" },
      { "target": "aliasByNode(movingMedian(scale(nonNegativeDerivative(keepLastValue(" + prefix + "[[instance]].swap.swap_io-out.value,10),0),-1),'5min'),5)" },
    ]
  };
}

function panel_network_octets(title, prefix, intrf) {
  intrf = (intrf === "undefined") ? 'interface-eth0' : intrf;
  return {
    title: title + ', ' + intrf,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: null},
    lines: true,
    fill: 2,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    linewidth: 1,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(movingMedian(nonNegativeDerivative(keepLastValue(" + prefix + "[[instance]]." + intrf + ".if_octets.rx,10),0),'5min'),6)" },
      { "target": "aliasByNode(movingMedian(scale(nonNegativeDerivative(keepLastValue(" + prefix + "[[instance]]." + intrf + ".if_octets.tx,10),0),-1),'5min'),6)" }
    ]
  };
}

function panel_network_packets(title, prefix, intrf) {
  intrf = (intrf === "undefined") ? 'interface-eth0' : intrf;
  return {
    title: title + ', ' + intrf,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: null},
    lines: true,
    fill: 2,
    linewidth: 1,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(movingMedian(nonNegativeDerivative(keepLastValue(" + prefix + "[[instance]]." + intrf + ".if_packets.rx,10),0),'5min'),5)" },
      { "target": "aliasByNode(movingMedian(scale(nonNegativeDerivative(keepLastValue(" + prefix + "[[instance]]." + intrf + ".if_packets.tx,10),0),-1),'5min'),5)" }
    ]
  };
}

function panel_df(title, prefix, vol) {
  vol = (vol === "undefined") ? 'df-root' : vol;
  return {
    title: title + ', ' + vol,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0, leftMin: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]]." + vol + ".df_complex-{free,used,reserved}.value,5)" },
    ],
    aliasColors: {
      "df_complex-used": "#ff6666",
      "df_complex-free": "#66b266",
      "df_complex-reserved": "#EAB839"
    }
  };
}

function panel_disk_ops(title, prefix, vol) {
  vol = (vol === "undefined") ? 'disk-xvda' : vol;
  return {
    title: title + ', ' + vol,
    type: 'graphite',
    span: arg_span,
    y_formats: ["none"],
    grid: {max: null, min: null},
    lines: true,
    fill: 2,
    linewidth: 1,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(nonNegativeDerivative(" + prefix + "[[instance]]." + vol + ".disk_ops.write,10),6)" },
      { "target": "aliasByNode(nonNegativeDerivative(" + prefix + "[[instance]]." + vol + ".disk_ops.read,10),6)" }
    ]
  };
}

function panel_disk_time(title, prefix, vol) {
  vol = (vol === "undefined") ? 'disk-xvda' : vol;
  return {
    title: title + ', ' + vol,
    type: 'graphite',
    span: arg_span,
    y_formats: ["none"],
    grid: {max: null, min: null},
    lines: true,
    fill: 2,
    linewidth: 1,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(nonNegativeDerivative(" + prefix + "[[instance]]." + vol + ".disk_time.write,10),6)" },
      { "target": "aliasByNode(nonNegativeDerivative(" + prefix + "[[instance]]." + vol + ".disk_time.read,10),6)" }
    ]
  };
}

function panel_disk_octets(title, prefix, vol) {
  vol = (vol === "undefined") ? 'disk-xvda' : vol;
  return {
    title: title + ', ' + vol,
    type: 'graphite',
    span: arg_span,
    y_formats: ["none"],
    grid: {max: null, min: null},
    lines: true,
    fill: 2,
    linewidth: 1,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(nonNegativeDerivative(" + prefix + "[[instance]]." + vol + ".disk_octets.write,10),6)" },
      { "target": "aliasByNode(nonNegativeDerivative(" + prefix + "[[instance]]." + vol + ".disk_octets.read,10),6)" }
    ]
  };
}

function panel_disk_merged(title, prefix, vol) {
  vol = (vol === "undefined") ? 'disk-xvda' : vol;
  return {
    title: title + ', ' + vol,
    type: 'graphite',
    span: arg_span,
    y_formats: ["none"],
    grid: {max: null, min: null},
    lines: true,
    fill: 2,
    linewidth: 1,
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    nullPointMode: "null",
    targets: [
      { "target": "aliasByNode(nonNegativeDerivative(" + prefix + "[[instance]]." + vol + ".disk_merged.write,10),6)" },
      { "target": "aliasByNode(nonNegativeDerivative(" + prefix + "[[instance]]." + vol + ".disk_merged.read,10),6)" }
    ]
  };
}

/*
JMX metrices
*/

function panel_jvm_heap(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX-memory.jmx_memory-heap-*.value,5)" }
    ],
    aliasColors: {
      "jmx_memory-heap-used": "#ff6666"
    }
  };
}

function panel_jvm_nonheap(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX-memory.jmx_memory-nonheap-*.value,5)" }
    ],
    aliasColors: {
      "jmx_memory-nonheap-used": "#ff6666"
    }
  };
}

function panel_jvm_mem_pool_code_cache(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX-memory_pool-Code_Cache.jmx_memory-*.value,5)" }
    ],
    aliasColors: {
      "jmx_memory-used": "#ff6666"
    }
  };
}

function panel_jvm_mem_pool_eden_space(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX-memory_pool-Eden_Space.jmx_memory-*.value,5)" }
    ],
    aliasColors: {
      "jmx_memory-used": "#ff6666"
    }
  };
}

function panel_jvm_mem_pool_perm_gen(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX-memory_pool-Perm_Gen.jmx_memory-*.value,5)" }
    ],
    aliasColors: {
      "jmx_memory-used": "#ff6666"
    }
  };
}

function panel_jvm_mem_pool_survivor_space(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX-memory_pool-Survivor_Space.jmx_memory-*.value,5)" }
    ],
    aliasColors: {
      "jmx_memory-used": "#ff6666"
    }
  };
}

function panel_jvm_mem_pool_tenured_gen(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX-memory_pool-Tenured_Gen.jmx_memory-*.value,5)" }
    ],
    aliasColors: {
      "jmx_memory-used": "#ff6666"
    }
  };
}

function panel_jvm_mem_pool_gc_copy(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["none"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX-gc-Copy.*.value,5)" }
    ]
  };
}

function panel_jvm_mem_pool_gc_marksweepcompact(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["none"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX-gc-MarkSweepCompact.*.value,5)" }
    ]
  };
}

function panel_jvm_classes(title, prefix) {
  return {
    title: title,
    type: 'graphite',
    span: arg_span,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    lines: true,
    fill: 2,
    linewidth: 1,
    nullPointMode: "null",
    tooltip: {
      value_type: 'individual',
      shared: true
    },
    stack: true,
    targets: [
      { "target": "aliasByNode(" + prefix + "[[instance]].GenericJMX.*.value,5)" }
    ]
  };
}

/*
  row templates
*/

function row_delimiter(title) {
  return {
    title: "_____ " + title,
    height: "20px",
    collapse: false,
    editable: false,
    collapsable: false,
    panels: [{
      title: title,
      editable: false,
      span: 12,
      type: "text",
      mode: "text"
    }]
  };
}

function row_cpu_memory(title, prefix) {
  return {
    title: title,
    height: '250px',
    collapse: false,
    panels: [
      panel_cpu('CPU, %', prefix),
      panel_memory('Memory', prefix),
      panel_loadavg('Load avg', prefix)
    ]
  };
}

function row_swap(title, prefix) {
  return {
    title: title,
    height: '250px',
    collapse: true,
    panels: [
      panel_swap_size('Swap size', prefix),
      panel_swap_io('Swap IO', prefix),
    ]
  };
}

function row_network(title, prefix, filter) {
  var interfaces = find_filter_values(filter + '.interface-*');
  var panels_network = [];
  var i;
  for (i in interfaces) {
    if (interfaces.hasOwnProperty(i)) {
      panels_network.push(
        panel_network_octets('network octets', prefix, interfaces[i]),
        panel_network_packets('network packets', prefix, interfaces[i])
      );
    }
  }
  return {
    title: title,
    height: '250px',
    collapse: true,
    panels: panels_network
  };
}

function row_disk_space(title, prefix, filter) {
  var volumes = find_filter_values(filter + '.df-*');
  var panels_disk_space = [];
  var i;
  for (i in volumes) {
    if (volumes.hasOwnProperty(i)) {
      panels_disk_space.push(panel_df('disk space', prefix, volumes[i]));
    }
  }
  return {
    title: title,
    height: '250px',
    collapse: true,
    panels: panels_disk_space
  };
}

function row_disk_ops(title, prefix, filter) {
  var volumes = find_filter_values(filter + '.disk-*');
  var panels_disk_usage = [];
  var i;
  for (i in volumes) {
    if (volumes.hasOwnProperty(i)) {
      panels_disk_usage.push(panel_disk_ops('disk ops read/write', prefix, volumes[i]));
    }
  }
  return {
    title: title,
    height: '250px',
    collapse: true,
    panels: panels_disk_usage
  };
}

function row_disk_time(title, prefix, filter) {
  var volumes = find_filter_values(filter + '.disk-*');
  var panels_disk_usage = [];
  var i;
  for (i in volumes) {
    if (volumes.hasOwnProperty(i)) {
      panels_disk_usage.push(panel_disk_time('disk time read/write', prefix, volumes[i]));
    }
  }
  return {
    title: title,
    height: '250px',
    collapse: true,
    panels: panels_disk_usage
  };
}

function row_disk_octets(title, prefix, filter) {
  var volumes = find_filter_values(filter + '.disk-*');
  var panels_disk_usage = [];
  var i;
  for (i in volumes) {
    if (volumes.hasOwnProperty(i)) {
      panels_disk_usage.push(panel_disk_octets('disk octets read/write', prefix, volumes[i]));
    }
  }
  return {
    title: title,
    height: '250px',
    collapse: true,
    panels: panels_disk_usage
  };
}

function row_disk_merged(title, prefix, filter) {
  var volumes = find_filter_values(filter + '.disk-*');
  var panels_disk_usage = [];
  var i;
  for (i in volumes) {
    if (volumes.hasOwnProperty(i)) {
      panels_disk_usage.push(panel_disk_merged('disk merged read/write', prefix, volumes[i]));
    }
  }
  return {
    title: title,
    height: '250px',
    collapse: true,
    panels: panels_disk_usage
  };
}

function row_jvm(title, prefix) {
  return {
    title: title,
    height: '250px',
    collapse: true,
    panels: [
      panel_jvm_heap('JVM Heap Memory', prefix),
      panel_jvm_nonheap('JVM NonHeap Memory', prefix),
      panel_jvm_mem_pool_code_cache('Code Cache', prefix),
      panel_jvm_mem_pool_eden_space('Eden Space', prefix),
      panel_jvm_mem_pool_perm_gen('Perm Gen', prefix),
      panel_jvm_mem_pool_survivor_space('Survivor Space', prefix),
      panel_jvm_mem_pool_tenured_gen('Tenured Gen', prefix),
      panel_jvm_mem_pool_gc_copy('GC Copy', prefix),
      panel_jvm_mem_pool_gc_marksweepcompact('GC MarkSweepCompact', prefix),
      panel_jvm_classes('Classes', prefix)
    ]
  };
}

/*jslint unparam: true, node: true */
return function(callback) {

// Setup some variables
  var dashboard;

  var prefix = arg_reg + '.' + arg_env + '.' + arg_stack + '.';

  var arg_filter = prefix + arg_i;

// set filter
  var dashboard_filter = {
    time: {
      from: "now-" + arg_from,
      to: "now"
    },
    list: [
      get_filter_object("instance", arg_filter, false)
    ]
  };

// define pulldowns
  var pulldowns = [
    {
      type: "filtering",
      collapse: false,
      notice: false,
      enable: true
    },
    {
      type: "annotations",
      enable: false
    }
  ];

// Intialize a skeleton with nothing but a rows array and service object

  dashboard = {
    rows : [],
    services : {}
  };
  dashboard.title = prefix + arg_i;
  dashboard.editable = false;
  dashboard.pulldowns = pulldowns;
  dashboard.services.filter = dashboard_filter;

  var jmx_metrics = expand_filter_values(prefix + arg_i + '.GenericJMX*');

  $.ajax({
    method: 'GET',
    url: '/'
  })
    .done(function (result) {

  // costruct dashboard rows

      dashboard.rows.push(
        row_cpu_memory('cpu, memory, load', prefix),
        row_swap('Swap', prefix),
        row_network('network', prefix, arg_filter),
        row_disk_space('disk space', prefix, arg_filter),
        row_disk_ops('disk ops', prefix, arg_filter),
        row_disk_time('disk time', prefix, arg_filter),
        row_disk_octets('disk octets', prefix, arg_filter),
        row_disk_merged('disk merged', prefix, arg_filter)
      );

      // custom rows
      if (jmx_metrics.length) {
        dashboard.rows.push(row_jvm('JMX', prefix));
      }
      callback(dashboard);
    });
}