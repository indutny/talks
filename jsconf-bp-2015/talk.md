# Diving into io.js C++ internals... or the history of one `git blame`

Ideas:

* `git blame src/` - history of us fighting the v8, `git blame deps/v8` history
  of v8 fighting us
* C++ Calligraphy, bad at first, then - either terrible and indistinguishable,
  or great.
* Everyone here already wrote C++ code if you tried to make your JavaScript apps
  faster. Fast JS is looking tremendously similar to the C++:
  * Classes with static properties (no hidden classes!)
  * Static typing (monomorphic loads and values)
  * Manual memory allocation (caching objects for GC performance reasons)
* C++/JS bridge via integer indexes on objects (credit to Ben Noordhuis),
  fighting compiler
* Referencing JS objects, fighting GC
* Fighting leaks
* ObjectWrap history and why it is no longer used in core, how publishing it
  helped us to improve the core internals
* Chris' suggestion: another thing that might be good to touch on is the
  interaction between node startup, libuv, and v8
* Another suggestion by Chris: a diagram or picture would probably be best –
  just to make sure that folks know that's how you get from JS to C++.
  Maybe even have the (abridged) C++ class source on the left hand side, the
  usage of the JS equivalent on the right hand side, and arrows pointing from
  method invocations on the JS side to method definitions on the C++ side

## Outline

1. Intro: Why do we need C++ layer in node.js . Why everyone here could write
   C++: hidden classes, monomorphic loads, manual mem allocation.
2. Short history of C++ layer in node.js. liboi, libev, libuv, moving to
   ObjectWrap, AsyncWrap. Integer indexes in arrays.
3. File structure: src/ to lib/, back and forth.
4. How JS communicates with C++. `process.binding(...)`, function templates that
   hold the reference to the C++ object
5. How async primitives organized: handles, wraps
6. C++ Streams API, and my hopes for it

## Intro

It might seem crazy to speak about C++ on a JavaScript conference, but if you
ever tried to optimize JavaScript code to squeeze every possible performance or
memory usage improvement out of it - you already wrote some C++ code.

Many blogs, workshops mention optimizing the JavaScript, and some of the popular
suggestions are:

* Declare all properties in the constructor to avoid "hidden classes". Which is
  makes them pretty much the same as a C structures, or C++ classes. Stuff
  should be declared ahead of time to help the compiler optimize it.
* Avoid storing different types of values in a variables, and avoid passing
  different types as the same argument to the function. This principle could
  also be called "Make your code monomorphic", or do not mess with the compiler,
  and this is pretty much the same as a static typing in C/C++.
* Cache and reuse instances and objects that are often allocated to avoid GC
  pauses. This is one is sort of a manual memory allocation.

Slide suggestion from Chris:

    Oh, no – when you make slides, it'd be good to show something like:

    function Point(x, y, z) {
      this.x = x
      this.y = y
      this.z = z
    }

    And then compare it to:

    class Point {
      public:
        double x, y, z;
    }

    To illustrate what "writing JS like C++ for optimization purposes" looks
    like.

To conclude, even if you never wrote C++ code, you actually very likely did it
in JS.

No surprise we use C++ in io.js/node.js. V8 is written in C++ after all and it
is only providing a limited, mostly ECMAScript-only JavaScript APIs. They are
definitely cool, but if you ever used `setTimeout()`/`clearTimeout()` - you
won't have them in plain ECMAScript. At least not yet.

Our C++ layer lives on top of the event-loop and provides all sorts of APIs:
from net sockets to dns queries, from file system events to the zlib bindings.

## Short History of C++ layer, or history of one `git blame`

To better understand all of these, and to ease the contribution process - it
might be a good idea to start with the history of the subject. Luckily, from its
inception, node.js is using VCS, in particular git, so the history of the
development might be revealed by running `git log` and `git blame` on it.

Briefly, `git log deps/v8` - has the history of v8 fighting us, and
`git log src/` - has the history of us fighting v8.

## Very first version

Jokes aside, everything started from 61890720 commit. The commit log just says:

    add readme and initial code

Unfortunately, we can't elaborate much from it, and need to figure out the
details ourselves. What do we see there?

* [libebb][0] - which was used as an HTTP parser. Ryan used the code
  from the [Ebb][3] server that he has previously written for Ruby
* [liboi][1]- which was as a TCP server framework on top of the [libev][2].
  liboi stands for `Library for Output Input`

So the first code (that actually started compiling only at 7b7ceea) only had one
HTTP server and supplied JavaScript source code was just a handler for it. How
was it organized internally?

There was a `server.cc` file which was reading the command line options, loading
the JS source file, feeding all of these into V8, and starting the HTTP
server.

Second C++ file was `js_http_request_processor.cc` and it was responsible for
invoking JavaScript http request handler. Kind of overshoot, right?

It wasn't working that much at that point, and didn't have any of
functionality that is provided today. So let's conclude and move on from it
quickly:

* One file to setup V8 and let JavaScript know about command-line arguments
* HTTP server fully implemented in C/C++, not invoking JavaScript for any
  networking activities
* One C++ instance per every incoming request, this instance maps some of the
  HTTP fields (like host, url, method) to the JavaScript object.

This is very important to note, the C++ instance <-> JS object mapping is
building brick of all future releases of node.js

## 064c8f02

Now we quickly jump to 064c8f02. The commit log says:

    Use ObjectWrap base class for File, Socket, Server.

And this is the point where node.js has introduced one API to wrap all objects.

Now `net.Server`, `net.Socket`, `File` C++ classes are children of this
`ObjectWrap` class. Which technically means that for every instance of them -
there will be one instance of JS object that allows invoking C++ methods of
these classes, and reading properties of this object in C++ (even invoking
the callbacks!)

There are now different files for different parts of the provided api:

* `src/node.cc` now sets up C++ libraries and invokes `src/main.js` which is
  loading script file and does some JavaScript initialization. This is what is
  done now too. We put as much as possible of the API into js module, and leave
  the rest in the C++ land.
* `src/http.cc` provides http server API, Connection, HttpRequest objects
* `src/file.cc`, `src/file.js` are basically something that grew up into `fs`
  module. `src/file.js` consists of the API abstractions for the C++ layer,
  basically the same thing as with `src/node.cc` and `src/main.js`
* `src/process.cc` provides `exit` method. Will grow up into `process` object.
* `src/timers.cc` is about `setTimeout`/`setInterval`

Just a side note: HTTP server is still provided by [liboi][1], and node.js is
using [libev][2].

## v0.2

There was lots of growing and maturing from that commit to the v0.2, and most
notable of them were about separating the JS parts from the C++ ones,
adding CommonJS support, and tons of modules! At this point node.js file
structure starts looking like what we have now:

* `lib/` folder for all JavaScript CommonJS modules
* `src/` for their C++ counterparts
* `deps/` for all dependencies: v8, http-parser, c-ares (for async DNS),
  libeio (for async FS), and libev (for async networking and auxiliary stuff)

Previously barely used through the `src/`, `ObjectWrap` now became a public API,
which helped polish it out a lot and improved our core use case as well.

Very importantly, in 064c8f02 all C++ interfaces were global objects. In v0.2
they are provided by `process.binding` and are thus not directly visible to the
user's code. For example, `process.binding('fs')` returns lots of C++ methods
and classes that are heavily used for interoperation between C++ and JS in
`lib/fs.js`. Similar stuff is done for the rest of the `lib/` modules.

## v0.6

Just a short note: `libev` was removed and replaced by `libuv`. Lots of awesome
work by Ben Noordhuis, Bert Belder, Ryan Dahl, and others! A major milestone
in evolution of node.js. Windows is now in the list of the officially supported
platforms.

## v0.10

Good, stable, but boring...

## v0.12 and io.js

Lots of new stuff! :)

Mainly, we have outgrown the `ObjectWrap` to accommodate the tracing API (which
is still needs lots of rework, AFAIK). Now the hip thing is `AsyncWrap` which is
in many ways the same thing, but now is attached to some particular domain of
operation (i.e. http, dns, tls) and which might have the another `AsyncWrap` as
a parent. Note that `ObjectWrap` lives in `src/node_object_wrap.h`, and
`AsyncWrap` in `src/async-wrap.h`.

This is a present point of the node.js evolution, and like to stop with the
Software Archeology at this point.

## Interoperation, handles, wraps, and unicorns!

Now we are finally ready to dive into the C++ internals, and explore it.

As we already figured out - whole APIs provided by the node.js/io.js do live in
two folders: `lib` and `src`. `lib` holds the core modules, `src` holds their
C++ counterparts.

For example, when you do `require('fs')` - it is doing nothing but just
executing the contents of the `lib/fs.js` file. No magic here.

Now comes the interesting thing, JS is not capable of the file system
operations, nor it is capable of doing networking. At it is actually for the
best! (You don't want your browser to mess up with the whole file system,
right?) So when you do `fs.writeFileSync`, or when you are calling
`http.request()` there are lots of low-level C++ stuff happening outside of the
JS-land.

While the `fs` module is quite simple to explain, it is quite boring too. After
all, in the most of the cases it is just using number to represent the opened
file (so called, `file descriptor`), and is just passing this number around:
from C++ to JS, and from JS to C++. Nothing interesting, let's move on!

Certainly much more interesting is the `net` module. We create sockets, get
the `connect` events, and expect the `.write()` callbacks to be eventually
invoked. All of these should be powered by the C++ machinery!

And here is where most of the interoperation is actually happening. The
`tcp_wrap` and `stream_wrap` bindings (remember, `process.binding()`, right?)
provide very useful classes for JS-land: TCP, TCPConnectWrap, WriteWrap,
ShutdownWrap.

Where `TCP` holds the TCP socket and provides methods for writing and reading
stuff, and `*Wrap` objects is what you pass to the `TCP` methods when you expect
some async action to happen, and need to receive notification (callback) on its
completion.

For example, the normal workflow for `net.connect()` follows:

* Create `TCP` instance in `lib/net.js`, store it in the `_handle` property of
  the `net.Socket` object
* Parse all arguments to the `net.connect()`
* Create `TCPConnectWrap` instance (usually named `req`)
* Invoke `.connect()` method with `req, port, host`
* Get `req.oncomplete` function invoked eventually, once the connection was
  established, or once the kernel will report a error

In conclusion: most of the C++ classes are either handles, or requests.
Requests are very temporary and never outlive the handle that they are bound to,
while the handles is something that lives much longer (i.e. for the entire life
time of the TCP connection).

Speaking of the file structure: `TCP` is represented by the `TCPWrap` class in
`src/tcp_wrap.cc`, `TCPConnectWrap` lives in the same place, and `WriteWrap`
is in the `stream_base.cc` file (in io.js).

## Structure of C++ files

But how does the C++ provide this classes to the JavaScript? Each binding has
`NODE_MODULE_CONTEXT_AWARE_BUILTIN` macro that registers it in the `node.cc`.
This has the same effect as following JavaScript snippet:

```javascript
modules[moduleName] = {
  initialized: false,
  initFn: moduleInitFn
};
```

When `process.binding('moduleName')` is invoked, `node.cc` looks up the proper
internal binding in this hashmap and initializes it (if it wasn't previously
initialized) by calling the supplied function.

```javascript
process.binding = function(moduleName) {
  var module = modules[moduleName];
  if (module.initialized)
    return module.exports;

  module.exports = {};
  module.initFn(module.exports);
  return module.exports;
};
```

This initialization function receives `exports` object as an input, and exports
the methods and classes to it in a pretty much the same way as you normally do
in a CommonJS modules.

Each of the exported classes has a the C++ class, and most of them are actually
a `AsyncWrap` C++ class children.

The Handle instances are destroyed automatically by V8's GC, and the Wraps are
manually destroyed by the Handle, once they are not used anymore.

Side-note (do no talk about it): there are two types of references to the JS
objects from C++ land: normal and weak. By default `AsyncWrap`s a referencing
their objects in a `normal` way, which means that the JS objects representing
the C++ classes won't be garbage collected until C++ class will dispose the
reference. This might be very useful to know when debugging memory leaks.

## Small exam

Situation: you debug some io.js/node.js issue, and find that it is crashing when
instantiating a class provided by `process.binding('broken')`. Where will you
attempt to search the C++ source code of that class?

Answer: somewhere in `src/`. Find
`NODE_MODULE_CONTEXT_AWARE_BUILTIN(broken, ...)` and it is most like going to be
in `src/broken_something.cc`.

## C++ Streams

Now comes one of my recent obsessions. :) The C++ Stream API.

It is a established fact for me that exposing the building blocks of APIs helps
to renovate, reshape and make them better *a lot*. One of such thing that I was
always keen to re-do was a `StreamWrap` instance.

It was ok-ish in v0.10, but when we moved TLS (SSL) implementation into the C++
land - it has changed dramatically... and, honestly saying, not in a good way.

Previously singular `StreamWrap` instance, now became a monster that was capable
of passing the incoming data elsewhere, skipping the JavaScript callbacks
completely and doing some dark-magic OpenSSL machinery on top of it. The
implementation worked like a charm, providing much better TLS performance, but
the source code became cluttered and rigid.

This "move-parsing-to-elsewhere" thing reminded me a lot about that
`stream.pipe` that we had in JavaScript streams for ages. The natural thing to
do about it was to introduce something similar in the C++ land too. This is
exactly what was done in io.js, and the results of this live in
`src/stream_base.cc`.

## Next step with the C++ Stream APIs

Now we have very general implementation of this thing that could be reused in
many places. The first thing that I expect will be using this, might be an
HTTP2 stream. To do it in core, we should do it in user-land first, and it could
be accomplished only by exposing the C++ Stream API, in the same way as we did
it with ObjectWrap.

## Epilogue

So, I'm going to ask you:

* Clone the io.js repo
* Open the `src/`
* Go through files in it, and check what we have learned about today
* Open `src/stream_base.h`, `src/stream_base.cc` and friends and figure out
  what seems to be wrong to you
* Send a PR
* Have fun!

Thank you!

[0]: https://github.com/taf2/libebb
[1]: https://cs.fit.edu/code/projects/cse2410_fall2014_bounce/repository/revisions/90fc8d36220c0d66c352ee5f72080b8592d310d5/show/deps/liboi
[2]: http://software.schmorp.de/pkg/libev.html
[3]: https://github.com/gnosek/ebb
