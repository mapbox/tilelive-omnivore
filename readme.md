# tilelive-omnivore

Implements the tilelive api for a variety of raw data sources

[![Build Status](https://travis-ci.com/mapbox/tilelive-omnivore.svg?branch=master)](https://travis-ci.com/mapbox/tilelive-omnivore)

## Install

```
npm install -g @mapbox/tilelive-omnivore
```

## Example

```javascript
var Omnivore = require('@mapbox/tilelive-omnivore');
var filepath = '/absolute/path/to/geographic/data';
var uri = 'omnivore://' + filepath;

new Omnivore(uri, function(err, source) {
  source.getInfo(function(err, info) {
    console.log(info);
  });
});
```

Using the command line will output the XML directly to your shell.

```bash
mapnik-omnivore <filepath>
```

## Works with

any file supported by [mapnik-omnivore](https://github.com/mapbox/mapnik-omnivore)

## Command Line
