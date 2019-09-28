# RSL - REST Service Language

## Introduction

REST Service Language is a JavaScript library for easily creating REST services based on entities. RSL generates all routes and the corresponding database schema. Also RSL provides you functionality for filtering and expanding data in your requests.

## Documentation

### Installation

You can easily install RSL using `npm` or `yarn`:

```
npm install --save rsl
```

```
yarn add rsl
```

Since RSL is currently a NodeJS-only package there aren't other options for installing.

### Setup

To getting started with RSL you can directly import it:

```javascript
const RSL = require('rsl');
```

With that you could create a new app object:

```javascript
const app = new RSL({
    client: 'sqlite3',
    connection: {
        filename: "./mydb.sqlite"
    }
});
```

The object passed to the RSL constructor is a configuration object for [Knex.js](http://knexjs.org/). See their documentation for further instructions how to configure different database clients.

To start the server you need to call `listen` on the `app` object with the port and a callback function as parameters:

```javascript
app.listen(6586, () => console.log('Server is running'));
```

### Defining a type

A type is defined by an RSL definition:

```
type User {
    name: String
    email: String
    birthday: Date
}
```

Possible types are for attributes are:
* String (max. 255 characters)
* Float
* Integer
* Date
* Text
* Boolean

You can also reference custom types:

```
type User {
    name: String
    email: String
    birthday: Date
}

type Message {
    body: Text
    from: User
    to: User
}
```

To pass the RSL definition to the app use the following code snippet:

```javascript
const example = `
type User {
    name: String
    email: String
    birthday: Date
}

type Message {
    body: Text
    from: User
    to: User
}
`;

app.define(example);
```

That needs to be done before the `listen` function is called.

To have an array as type just add square brackets around the inner type:

```
type Car {
    color: [String]
}
```

### Routes

Given this example definition...

```
type User {
    name: String
    email: String
    birthday: Date
}
```

...the following routes are generated:

```
GET /user - All users are returned
GET /user/:id - A specific user is returned
POST /user - Create a new user
PUT /user/:id - Update a specific user
DELETE /user/:id - A user is deleted
```

To prefix a url to the routes you can use the `route` keyword in the definition:

```
route /api/v1.0

type User {
    name: String
    email: String
    birthday: Date
}
```

**Only use one route statement per definition!**

### Static content

To serve also static content, you can call the `static` function on the app object.

```javascript
app.static({
    path: path.resolve(__dirname, 'public'),
    route: '/'
});
```

The `path` option is the absolute path to the root folder. The `route` option defines where the content should be served to.

### Filter results

When calling a `GET` route without id you can pass a filtering option via query parameter.

Example:

```
GET /api/user?filter=id=1
```

If you want to pass multiple seperate them with a `,`.

**It is currently not possible to filter for expanded data or array data.**

### Expanding results

When calling any `GET` route you can pass a expanding option via query parameters. All named attributes with a custom type will then be expanded into full objects instead of returning the id of the corresponding object. You can also add multiple attributes by seperating with a `,`.

Example:

```
GET /api/message?expand=to,from
```
