// Polyfills for Node.js built-in modules
if (typeof window !== 'undefined') {
  // Process polyfill
  window.process = {
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development'
    },
    browser: true,
    versions: {},
    platform: 'browser',
    title: 'browser',
    argv: [],
    nextTick: require('next-tick')
  };

  // Buffer polyfill
  if (typeof window.Buffer === 'undefined') {
    window.Buffer = require('buffer').Buffer;
  }

  // Stream polyfill
  if (typeof window.Stream === 'undefined') {
    const { Readable, Writable, Transform, PassThrough } = require('stream-browserify');
    window.Stream = { Readable, Writable, Transform, PassThrough };
  }
}

// Polyfill for process object
const processPolyfill = {
  env: {
    NODE_ENV: 'development'
  },
  nextTick: (callback) => {
    setTimeout(callback, 0);
  },
  browser: true,
  version: '',
  versions: {},
  platform: 'browser',
  release: {},
  argv: [],
  execArgv: [],
  pid: 1,
  title: 'browser',
  arch: 'x64',
  cwd: () => '/',
  chdir: (dir) => {
    throw new Error('process.chdir is not supported in browser');
  },
  umask: () => 0,
  getuid: () => 0,
  getgid: () => 0,
  geteuid: () => 0,
  getegid: () => 0,
  getgroups: () => [],
  setuid: () => {},
  setgid: () => {},
  seteuid: () => {},
  setegid: () => {},
  setgroups: () => {},
  initgroups: () => {},
  _kill: () => {},
  kill: () => {},
  exit: () => {},
  exitCode: 0,
  allowedNodeEnvironmentFlags: new Set(),
  features: {},
  _preload_modules: [],
  binding: () => {
    throw new Error('process.binding is not supported in browser');
  },
  dlopen: () => {},
  uptime: () => 0,
  memoryUsage: () => ({
    rss: 0,
    heapTotal: 0,
    heapUsed: 0,
    external: 0
  }),
  _getActiveRequests: () => [],
  _getActiveHandles: () => [],
  activeDeprecations: {},
  emitWarning: () => {},
  on: () => processPolyfill,
  addListener: () => processPolyfill,
  once: () => processPolyfill,
  prependListener: () => processPolyfill,
  prependOnceListener: () => processPolyfill,
  removeListener: () => processPolyfill,
  off: () => processPolyfill,
  removeAllListeners: () => processPolyfill,
  setMaxListeners: () => processPolyfill,
  getMaxListeners: () => 0,
  listeners: () => [],
  rawListeners: () => [],
  emit: () => false,
  listenerCount: () => 0,
  eventNames: () => []
};

// Add process polyfill to window object
window.process = processPolyfill;

// Add Buffer polyfill if needed
if (typeof window.Buffer === 'undefined') {
  window.Buffer = {
    alloc: () => new Uint8Array(),
    from: () => new Uint8Array(),
    isBuffer: () => false
  };
}

// Import stream-browserify
import { Readable, Writable, Transform, PassThrough } from 'stream-browserify';

// Add stream polyfills to window object
window.Stream = {
  Readable,
  Writable,
  Transform,
  PassThrough
}; 