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

| Variable  | Description                                                                        | Options                  | Default     |
| --------- | ---------------------------------------------------------------------------------- | ------------------------ | ----------- |
| NODE_ENV  | Applicaton environment. When in production, js bundles will be minified by default | development, production  | development |
| LOG_LEVEL | Which level the console transport log should log at                                | debug, info, warn, error | debug       |
| PORT      | The port the server should bind to                                                 | -                        | 7100        |

### Start

```bash
asset-pipe-server
```

OR with configuration options:

```bash
PORT=3321 LOG_LEVEL=info NODE_ENV=production asset-pipe-server
```

### A note on optimistic bundling

The asset server can produce asset bundles in what we call an "optimistic" fashion. This means that asset bundles will be automatically produced and reproduced any time an asset changes or any time
the definition of which assets should be included in a bundle changes.

In order to take advantage of this feature, you need to exclusively make use of the `/publish-assets` endpoint when uploading `js` and `css` assets, and the `/publish-instructions` endpoint when defining
or updating the definitions of which assets to include in a given bundle.

#### How optimistic bundling works

Step 1. publish any assets

Step 2. publish instructions on how bundles should be produced.

**Note:** order is not important. You can publish instructions first, then assets or vice versa. You can publish some assets, then instructions, then more assets. Any republishes will trigger new bundles as required.

**Simple Example**

1. Publish some assets by sending the payloads to `/publish-assets`.

```js
/* request 1: */ { tag: 'server1', type: 'js', data: [/* asset feed as produced by asset pipe client */] }
/* request 2: */ { tag: 'server2', type: 'js', data: [/* asset feed as produced by asset pipe client */] }
/* request 3: */ { tag: 'server3', type: 'js', data: [/* asset feed as produced by asset pipe client */] }
```

2. Publish some instructions by sending an instruction payload to `/publish-instructions`

```js
{ tag: 'server4', type: 'js', data: ['server1', 'server2', 'server3'] }
```

In order to refer to a bundle, you can compute the name of the published bundle as follows:

1. compute an sha256 hash for each feed. ie a hash of the data property for each asset publish. (`/publish-assets` also returns this hash each time an asset feed is published)
2. compute a hash of all hashes produced in step 1. (order is important)
3. append the correct file extension to the hash (`<hash>.js`).

You can then download the bundle from `/bundle/:hash`

## Endpoints

The server provides the following endpoints:

| Verb | Endpoint              | Description                                                                      | url params   | query params    | payload                | response          |
| ---- | --------------------- | -------------------------------------------------------------------------------- | ------------ | --------------- | ---------------------- | ----------------- |
| POST | /feed/js              | Upload a javascript asset feed                                                   | -            | -               | `js feed`              | `feed response`   |
| POST | /feed/js/:id          | Upload a javascript asset feed and persist metadata to build server              | `identifier` | -               | `js feed`              | `feed response`   |
| POST | /feed/css             | Upload a css asset feed                                                          | -            | -               | `css feed`             | `feed response`   |
| POST | /feed/css/:id         | Upload a css asset feed and persist metadata to build server                     | `identifier` | -               | `css feed`             | `feed response`   |
| GET  | /feed/:id             | Download an asset feed                                                           | `feed id`    | -               | -                      | `feed`            |
| POST | /bundle/js            | Request bundling of a list of js feeds                                           | -            | minify: `false` | `js bundle`            | `bundle response` |
| POST | /bundle/js/:id        | Request bundling of a list of js feeds and persist metadata to build server      | `identifier` | minify: `false` | `js bundle`            | `bundle response` |
| POST | /bundle/css           | Request bundling of a list of css feeds                                          | -            | -               | `css bundle`           | `bundle response` |
| POST | /bundle/css/:id       | Request bundling of a list of css feeds and persist metadata to build server     | `identifier` | -               | `css bundle`           | `bundle response` |
| GET  | /bundle/:id           | Download an asset bundle                                                         | `bundle id`  | -               | -                      | `bundle`          |
| POST | /publish-assets       | Publish an asset feed in an "optimistic bundling" compatible way.                | -            | -               | `asset definition`     | `feed response`   |
| POST | /publish-instructions | Publish an asset bundling instruction to begin "optimistically bundling" assets. | -            | -               | `bundling instruction` | `{success: true}` |

See below for explanation and additional detail regarding the various url params, payloads and responses.

### Url params

#### `identifier`

A unique identifing if for the uploader. A good candidate for use here is the package.json name value of the uploader.

_Examples_

```bash
POST /feed/js/my-server-1
POST /feed/css/my-server-1
```

#### `feed id`

A js or css feed filename. (Depending on endpoint)

_Examples_

```bash
GET /feed/js/acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json
GET /feed/css/bcd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json
```

#### `bundle id`

A js or css bundle filename. (Depending on endpoint)

_Examples_

```bash
GET /bundle/js/acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json
GET /bundle/css/bcd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json
```

### Payloads

#### `js feed`

An array of feed objects as produced by [asset-pipe-js-writer](https://github.com/asset-pipe/asset-pipe-js-writer)

_Example_

```json
[
    {
        "id": "c645cf572a8f5acf8716e4846b408d3b1ca45c58",
        "source":
            "\"use strict\";module.exports.world=function(){return\"world\"};",
        "deps": {},
        "file": "./assets/js/bar.js"
    }
]
```

#### `css feed`

An array of feed objects as produced by [asset-pipe-css-writer](https://github.com/asset-pipe/asset-pipe-css-writer)

_Example_

```js
[
    {
        id: "4f32a8e1c6cf6e5885241f3ea5fee583560b2dfde38b21ec3f9781c91d58f42e",
        name: "my-module-1",
        version: "1.0.1",
        file: "my-module-1/main.css",
        content: "/* ... */"
    }
];
```

#### `js bundle`

An ordered array of js feed filenames.

_Example_

```js
[
    "acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json",
    "acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json",
    "acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json"
];
```

#### `css bundle`

An ordered array of css feed filenames.

_Example_

```js
[
    "acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json",
    "acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json",
    "acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json"
];
```

#### `asset definition`

An object containing both metadata and an asset feed to be published on the asset server.

_Example_

```js
{
    tag: 'my-tag', // alphanumeric unique tag to identify all assets sent from this source. Eg. podlet-1, recommendations, my-tag
    type: 'js', // js or css
    data: [] // this is either a "js feed" or a "css feed" as described above
}
```

#### `bundling instruction`

An object containing both metadata and an array of tags to bundle together

_Example_

```js
{
    tag: 'my-tag', // unique tag to identify all assets sent from this source.
    type: 'js', // js or css
    data: ['tag1', 'tag2', 'tag3'] // this is an array of strings determining which asset feeds (by tag) should be included in the bundle (order is important)
}
```

### Responses

#### `feed response`

After a feed is uploaded, the server will respond with a json body containing the keys `file` and `uri`
where `file` is the name of the feed file that was saved on the server and `uri` is the same as `file` but with the server address prepended.

_Example_

```js
{
    file: 'acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json',
    uri: 'http://127.0.0.1:7100/acd1ac21dac12dac12dac12dac1d2ac1d2ac1d2a.json'
}
```

#### `feed`

Feed is the original js or css feed content that was saved on the server during a feed upload (via POST /feed/js or POST /feed/css)

_Example_

```json
[
    {
        "id": "c645cf572a8f5acf8716e4846b408d3b1ca45c58",
        "source":
            "\"use strict\";module.exports.world=function(){return\"world\"};",
        "deps": {},
        "file": "./assets/js/bar.js"
    }
]
```

#### `bundle response`

After a bundling is complete, the server will respond with a json body containing the keys `file` and `uri`
where `file` is the name of the file for the bundled content that was saved on the server and `uri` is the same as `file` but with the server address prepended.

_Example_

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

* Fork this repository.
* Make your changes as desired.
* Run the tests using `npm test`. This will also check to ensure that 100% code coverage is maintained. If not you may need to add additional tests.
* Stage your changes.
* Run `git commit` or, if you are not familiar with [semantic commit messages](https://docs.google.com/document/d/1QrDFcIiPjSLDn3EL15IJygNPiHORgU1_OOAqWjiDU5Y/edit), please run `npm run cm` and follow the prompts instead which will help you write a correct semantic commit message.
* Push your changes and submit a PR.
