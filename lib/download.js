var assert = require('assert')
var logger = require('status-logger')
var prettyBytes = require('pretty-bytes')
var Dat = require('dat-node')
var ui = require('../ui')

module.exports = function (type, opts, dat) {
  assert.ok(type, 'lib/download download type required')
  assert.ok(['sync', 'clone', 'pull'].indexOf(type) > -1, 'lib/download download type must be sync, clone, pull')

  // TODO: clean up this logic
  var resume = opts.resume || false
  if (!opts.key && !resume) return ui.exit()('Key required')

  var network = null
  var stats = null
  var connected = false

  // Logging Init
  var output = [
    [
      'Starting Dat...', // Shows Folder Name
      '', // Shows Link
      '', // Shows Downloading Progress Bar
      '', // Shows Total Size Info
      '' //  spacer before network info
    ],
    [] // Shows network information
  ]
  var progressOutput = output[0] // shortcut for progress output
  var log = logger(output, {debug: false, quiet: false})

  // UI Elements
  var bar = ui.bar()
  var exit = ui.exit(log)

  setInterval(function () {
    if (stats) updateDownload()
    if (network) updateNetwork()
    log.print()
  }, opts.logspeed)

  if (!dat) Dat(opts.dir, opts, start)
  else start(null, dat)

  function start (err, dat) {
    if (err) return exit(err)
    var archive = dat.archive

    // General Archive Info
    var niceType = (type === 'clone') ? 'Cloning' : type.charAt(0).toUpperCase() + type.slice(1) + 'ing'
    progressOutput[0] = `${niceType} Dat Archive: ${dat.path}`
    progressOutput[1] = ui.link(archive) + '\n'

    // Stats
    stats = dat.stats()
    stats.on('update:blocksProgress', checkDone)

    // Network
    progressOutput[2] = 'Looking for Dat Archive in Network'
    network = dat.network(opts)
    network.swarm.once('connection', function (peer) {
      connected = true
      progressOutput[2] = 'Starting Download...'
    })
  }

  function updateDownload () {
    var st = stats.get()
    if (!st.blocksTotal) {
      progressOutput[2] = '... Fetching Metadata'
      return
    }

    var progress = Math.round(st.blocksProgress * 100 / st.blocksTotal)
    if (progress === 100) return checkDone()
    progressOutput[2] = bar(progress)
    if (!connected) progressOutput[3] ='Waiting for connections to update progress...'
    else progressOutput[3] = `Total size: ${st.filesTotal} ${st.filesTotal === 1 ? 'file' : 'files'} (${prettyBytes(st.bytesTotal)})`
  }

  function updateNetwork () {
    output[1] = ui.network(network.peers(), stats.get())
  }

  function checkDone () {
    var st = stats.get()
    if (connected && st.blocksTotal && st.blocksProgress === st.blocksTotal) {
      progressOutput[2] = (type === 'sync') ? 'Files updated to latest!' : 'Download Finished!'
      progressOutput[3] = `Total size: ${st.filesTotal} ${st.filesTotal === 1 ? 'file' : 'files'} (${prettyBytes(st.bytesTotal)})`
      if (opts.exit !== false) return exit()
    }
  }
}