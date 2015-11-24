# Knockout Deep Watcher
Deeply and dynamically observe an object hierarchy. This knockout plugin will scan an object or array for observables, scanning the entire object graph, subscribing to each observable. As observable values are changed, those values are then scanned so the plugin continues to monitor changes that occur within the object graph.

## API

The deep watcher hooks into Knockout's `subscribe` method, using "deep" as the event name. 

```js
observable.subscribe(callback, thisArg, "deep");
```

The subscription callback will return a single argument object with the following properties:

- *target* - The observable which triggered the subscription.
- *parent* - The parent object or array of the target.
- *key* - The property name or index of the target.
- *value* - The new value of the target after the change.
- *priorValue* - The value of the object before the change.

There are convenience methods attached to the knockout global (`ko`) as well.

```js
ko.watch(target, callback, options);
```

- *target - Object* - The target is the object to be scanned. (The target does not need to be an observable itself.)

- *callback - Function* - The subscription callback.

- *options (optional) - Object* - Options to use when subscribing. There are two options:
  - *valueAccessor - Function* - A function which receives the value, key (propertyName/index), and the object. You should return the value to be used for subscribing to. This is useful if your observables are wrapped in ES5 property getters - you can get the underlying observable and return that to be observed.

  - *shouldWatch - Function* - A function which receives the observable, key, and object. Return true if you'd like the observable to be watched or false for it to be ignored.

There is also a `watch` method added to subscribable instances which can be used for ignoring observables or pausing notifications from the observable.

```js
// ignore changes
observable.watch(false);

// do stuff without triggering notifications

// resume watching
observable.watch(true);
```

(If a function is passed to this method, it creates a deep subscription to the observable using the function as callback.)

Default options can be set on `ko.watch.defaultOptions` and will be used unless overriden during the subscription.
