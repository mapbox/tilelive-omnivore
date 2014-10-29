var test = require('tape').test;
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var fixtures = require('./fixtures');
var expected = require('./expected');
var datasets = require('./datasets');
var Omnivore = require('..');
var queue = require('queue-async');

test('metadata => xml', function(t) {
  var xml;
  for (var type in fixtures) {
    xml = Omnivore.getXml(fixtures[type]);
    var m = /<Parameter name="file">(.+?)<\/Parameter>/.exec(xml);
    if (m) xml = xml.replace(m[1], '[FILEPATH]');

    if (process.env.UPDATE) {
      try { assert.equal(xml, expected[type]); }
      catch(err) { newExpectations(type, xml); }
    } else {
      t.equal(xml, expected[type], 'correct xml for ' + type);
    }
  }
  t.end();
});

function newExpectations(type, xml) {
  console.log('updated expected xml for ' + type);
  fs.writeFileSync(path.resolve(__dirname, 'expected', type + '.mapnik.xml'), xml);
}

test('build bridges', function(t) {
  var q = queue();

  for (var type in datasets) {
    var uri = 'omnivore://' + datasets[type];
    q.defer(testDataset, type);
  }

  q.await(function() {
    t.end();
  });

  function testDataset(type, callback) {
    var uri = 'omnivore://' + datasets[type];
    new Omnivore(uri, function(err, src) {
      t.ifError(err, 'source ready for ' + type);
      src.getInfo(function(err, info) {
        t.ifError(err, 'got info for ' + type);
        src.close(function(err) {
          t.ifError(err, 'closed source for ' + type);
          callback();
        });
      });
    });
  }
});
