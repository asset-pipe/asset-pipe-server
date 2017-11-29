<!-- TITLE/ -->

<h1>@asset-pipe/server</h1>

<!-- /TITLE -->


<!-- BADGES/ -->

<span class="badge-travisci"><a href="http://travis-ci.org/asset-pipe/asset-pipe-build-server" title="Check this project's build status on TravisCI"><img src="https://img.shields.io/travis/asset-pipe/asset-pipe-build-server/master.svg" alt="Travis CI Build Status" /></a></span>
<span class="badge-npmversion"><a href="https://npmjs.org/package/@asset-pipe/server" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@asset-pipe/server.svg" alt="NPM version" /></a></span>
<span class="badge-daviddm"><a href="https://david-dm.org/asset-pipe/asset-pipe-build-server" title="View the status of this project's dependencies on DavidDM"><img src="https://img.shields.io/david/asset-pipe/asset-pipe-build-server.svg" alt="Dependency Status" /></a></span>
<span class="badge-daviddmdev"><a href="https://david-dm.org/asset-pipe/asset-pipe-build-server#info=devDependencies" title="View the status of this project's development dependencies on DavidDM"><img src="https://img.shields.io/david/dev/asset-pipe/asset-pipe-build-server.svg" alt="Dev Dependency Status" /></a></span>

<!-- /BADGES -->


[![Greenkeeper badge](https://badges.greenkeeper.io/asset-pipe/asset-pipe-build-server.svg)](https://greenkeeper.io/)

## Usage

### Install
```bash
npm install @asset-pipe/build-server
```

### Configure

Configuration of the server is done via environment variables. 

The following configuration options are available:

| Variable  | Description                                         | Options                  | Default     |
|-----------|-----------------------------------------------------|--------------------------|-------------|
| NODE_ENV  | Applicaton environment                              | development, production  | development |
| LOG_LEVEL | Which level the console transport log should log at | debug, info, warn, error | debug       |
| PORT      | The port the server should bind to                  | -                        | 7100        |

### Start

```bash
asset-pipe-server
```

OR with configuration options:

```bash
PORT=3321 LOG_LEVEL=info NODE_ENV=production asset-pipe-server
```

## Endpoints

The server provides the following endpoints:

| Verb | Endpoint     | Description                              | url params | payload      | response          |
|------|--------------|------------------------------------------|------------|--------------|-------------------|
| POST | /feed/js     | Upload a javascript asset feed           | -          | `js feed`    | `feed response`   |
| POST | /feed/css    | Upload a css asset feed                  | -          | `css feed`   | `feed response`   |
| GET  | /feed/:id    | Download an asset feed                   | `feed id`  | -            | `feed`            |
| POST | /bundle/js   | Request bundling of a list of js feeds   | -          | `js bundle`  | `bundle response` |
| POST | /bundle/css  | Request bundling of a list of css feeds  | -          | `css bundle` | `bundle response` |
| GET  | /bundle/:id  | Download an asset bundle                 | `bundle id`| -            | `bundle`          |

See below for explanation and additional detail regarding the various url params, payloads and responses.

### Url params

#### `feed id`
A js or css feed filename. (Depending on endpoint)

*Examples*
```bash
GET /feed/js/acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json
GET /feed/css/bcd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json
```
#### `bundle id`
A js or css bundle filename. (Depending on endpoint)

*Examples*
```bash
GET /bundle/js/acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json
GET /bundle/css/bcd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json
```

### Payloads

#### `js feed`
An array of feed objects as produced by [asset-pipe-js-writer](https://github.com/asset-pipe/asset-pipe-js-writer)

*Example*
```json
[
    {
        "id":"c645cf572a8f5acf8716e4846b408d3b1ca45c58",
        "source":"\"use strict\";module.exports.world=function(){return\"world\"};",
        "deps":{},
        "file":"./assets/js/bar.js"
    }
]
```

#### `css feed`
An array of feed objects as produced by [asset-pipe-css-writer](https://github.com/asset-pipe/asset-pipe-css-writer)

*Example*
```js
[
    {
        id: '4f32a8e1c6cf6e5885241f3ea5fee583560b2dfde38b21ec3f9781c91d58f42e',
        name: 'my-module-1',
        version: '1.0.1',
        file: 'my-module-1/main.css',
        content: '/* ... */'
    }
]
```

#### `js bundle`
An ordered array of js feed filenames.

*Example*
```js
[
    'acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json',
    'acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json',
    'acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json'
]
```

#### `css bundle`
An ordered array of css feed filenames.

*Example*
```js
[
    'acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json',
    'acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json',
    'acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json'
]
```

### Responses

#### `feed response`
After a feed is uploaded, the server will respond with a json body containing the keys `file` and `uri`
where `file` is the name of the feed file that was saved on the server and `uri` is the same as `file` but with the server address prepended.

*Example*
```js
{
    file: 'acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json',
    uri: 'http://127.0.0.1:7100/acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json'
}
```

#### `feed`
Feed is the original js or css feed content that was saved on the server during a feed upload (via POST /feed/js or POST /feed/css)

*Example*
```json
[
    {
        "id":"c645cf572a8f5acf8716e4846b408d3b1ca45c58",
        "source":"\"use strict\";module.exports.world=function(){return\"world\"};",
        "deps":{},
        "file":"./assets/js/bar.js"
    }
]
```

#### `bundle response`
After a bundling is complete, the server will respond with a json body containing the keys `file` and `uri`
where `file` is the name of the file for the bundled content that was saved on the server and `uri` is the same as `file` but with the server address prepended.

*Example*
```js
{
    file: 'acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json',
    uri: 'http://127.0.0.1:7100/acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json'
}
```

#### `bundle`
Bundle is a piece of bundled javascript or css content.

## Contributing

The contribution process is as follows:

- Fork this repository.
- Make your changes as desired.
- Run the tests using `npm test`. This will also check to ensure that 100% code coverage is maintained. If not you may need to add additional tests.
- Stage your changes.
- Run `git commit` or, if you are not familiar with [semantic commit messages](https://docs.google.com/document/d/1QrDFcIiPjSLDn3EL15IJygNPiHORgU1_OOAqWjiDU5Y/edit), please run `npm run cm` and follow the prompts instead which will help you write a correct semantic commit message.
- Push your changes and submit a PR.
