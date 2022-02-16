# ABANDONED/UNSUPPORTED

# Tinode typescript and javascript SDK

This SDK is still under test and it's not released yet. but if you want to use it at this state you can build it yourself for now. this SDK can be used in browser, nodejs and typescript programs and contains needed declarations for each class.

## Build
Simply run `npm run build`. Now you are going to have dist folder containing browser and lib folder.

## Usage

### Browser
Import the browser script using the html script tag:
```html
<script src="./dist/browser/tinode.js"></script>
```

### Javascript
Import the library using `require`:
```js
const tinode = require('./dist/lib');
```

### Typescript and typescript based apps like angular
First copy `package.json` file into `dist/lib` folder. Then in that folder run `npm pack`. This will create a package that can be installed using npm or yarn. The created file will be named `tinode-sdk-x.y.z.tgz`.

Now you can install the package using `npm i tinode-sdk-x.y.z.tgz`.

To use this package in typescript use `import`:
```ts
import { Tinode } from 'tinode-sdk';
```

## Generate Document
Run this command:
```
npm run docs
```
