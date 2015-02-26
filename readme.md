# tilelive-omnivore

Implements the tilelive api for a variety of raw data sources

[![Build Status](https://travis-ci.org/mapbox/tilelive-omnivore.svg?branch=master)](https://travis-ci.org/mapbox/tilelive-omnivore)

## Install

```
npm install -g tilelive-omnivore
```

## Example

```javascript
var Omnivore = require('tilelive-omnivore');
var filepath = '/absolute/path/to/geographic/data';
var uri = 'omnivore://' + filepath;

new Omnivore(uri, function(err, source) {
  source.getInfo(function(err, info) {
    console.log(info);
  });
});
```

## Works with

any file supported by [mapnik-omnivore](https://github.com/mapbox/mapnik-omnivore)
