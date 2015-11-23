(function (root, factory) {
	if (typeof define === "function" && define.amd) {
		define(["knockout", "WeakMap"], factory);
	} else if (typeof exports === "object") {
		module.exports = factory(require("knockout"), require("WeakMap"));
	} else {
		factory(root.ko, root.WeakMap);
	}
}(this, function (ko, WeakMap) {
	"use strict";
	
	var watchableToken = "_watchable";
	var watchEventName = "deep";
	var returnTrue = function () { return true; };
	var returnValue = function (value) { return value; };
	
	var isArray = Array.isArray || function (obj) {
		return obj != null && Object.prototype.toString.call(obj) === "[object Array]";
	};
	
	var extend = Object.assign || function () {
		var arg = arguments[0];
		for (var i = 1, length = arguments.length; i < length; i++) {
			arg = ko.utils.extend(arg, arguments[i]);
		}
		
		return arg;		
	};
	
	function isObject (obj) {
		return obj && typeof obj === "object";
	}

	function isObservableArray (obj) {
		return ko.isObservable(obj) && "push" in obj;
	}
	
	function isWatchable (obj) {
		return obj[watchableToken] !== false;
	}
	
	function has (obj, key) {
		return Object.prototype.hasOwnProperty.call(obj, key);
	}
	
	function each (obj, func) {
		if (isArray(obj)) {
			for (var i = 0, length = obj.length; i < length; i++) {
				func(obj[i], i, obj);
			}
		} else if (isObject(obj)) {
			for (var key in obj) {
				if (has(obj, key)) {
					func(obj[key], key, obj);
				}
			}
		}
	}
	
  /**
	 * Watch any change that occurs within any observable within the object hierarchy.
   * @param  {any} root - The object to scan for observables.
   * @param  {Function} callback - The subscriber.
   * @param  {Object} options
	 * @param  {Function} options.valueAccessor - The function to be used to retrieve an objects value.
	 * Can be useful if the object contains observables wrapped in property getters. Takes the arguments:
	 * `Object:obj`, `String:key`, and `Object:parent`
	 * @param  {Function} options.shouldWatch - A function which indicates whether an observable should
	 * be subscribed to.
	 * @returns  {Object} The subscription object with a `dispose` function.
   */
	var koWatch = ko.watch = function (root, callback, options) {
		var visited = [];
		var wm = WeakMap();
		
		options = options ? extend({}, koWatch.defaultOptions, options) : koWatch.defaultOptions;
		var shouldWatch = options.shouldWatch || returnTrue;
	
		function getThen (func) {
			return function (value, key, obj) {
				if (options.valueAccessor) {
					value = options.valueAccessor(value, key, obj);
				}
				
				func(value, key, obj);
			}
		}	

		function watch (target, key, parent) {
			if (!target) {
				return;
			}

			if (ko.isSubscribable(target)) {
				subscribe(target, key, parent);
			} else if (isArray(target)) {
				each(target, getThen(watch));
			} else if (isObject(target)) {
				// keep a stack to prevent circular references
				if (ko.utils.arrayIndexOf(visited, target) >= 0) {
					return;
				}

				visited.push(target);
				each(target, getThen(watch));
			}
		}
		
		function unwatch (target) {
			if (!target) {
				return;
			}
			
			var index = ko.utils.arrayIndexOf(visited, target);
			if (index >= 0) {
				visited.splice(index, 1);
			}

			if (ko.isSubscribable(target) && wm.has(target)) {
				wm.get(target).dispose();
				wm["delete"](target);

				target = target.peek();
			}

			each(target, getThen(unwatch));
		}

		function subscribe (obj, key, parent) {
			if (!isWatchable(obj) || !shouldWatch(obj)) {
				return;
			}

			if (isObservableArray(obj)) {
				subscribeToArrayChanges(obj, parent);
			} else {
				subscribeToObjectChanges(obj, key, parent);
			}
			
			watch(obj.peek(), key, parent);
		}
		
		function subscribeToObjectChanges (obj, key, parent) {
			var priorValue = obj.peek();
			
			wm.set(obj, obj.subscribe(function (value) {
				unwatch(priorValue);
				
				if (isWatchable(obj)) {
					callback({
						target: obj, 
						parent: parent, 
						key: key, 
						value: value, 
						priorValue: priorValue
					});
				}
				
				watch(priorValue = value, key, parent);
			}));
		}
		
		function subscribeToArrayChanges (arr, parent) {
			// need to keep a clone of the array so we can get the original values
			// when items in an array are moved
			var arrayCopy = arr.peek().slice(0);
			
			wm.set(arr, arr.subscribe(function (changes) {
				ko.utils.arrayForEach(changes, function (change) {
					var priorValue, value;
					var moved = false;

					if ("moved" in change) {
						moved = true;

						if (change.status === "added") {
							value = change.value;
							priorValue = arrayCopy[change.index];
						} else {
							value = arrayCopy[change.moved];
							priorValue = change.value;
						}
					} else if (change.status === "added") {
						value = change.value;
					} else {
						priorValue = change.value;
					}

					if (isWatchable(arr)) {
						callback({
							target: arr,
							parent: parent,
							key: change.index,
							value: value,
							priorValue: priorValue
						});
					}
					
					if (!moved) {
						// if the item wasn't moved, need to either start watching or unwatching item
						(change.status === "added" ? watch : unwatch)(change.value, change.index, parent);
					}
				});

				arrayCopy = arr.peek().slice(0);
			}, null, "arrayChange"));
		}

		watch(root);

		return {
			dispose: function () {
				unwatch(root);
				
				// cleanup
				root = null;
				visited = [];
			}
		};
	};

	koWatch.defaultOptions = {
		valueAccessor: returnValue,
		shouldWatch: returnTrue
	};
	
	// hook into subscribe and watch for subscriptions to "deep" events
	// note: it doesn't look like there's a good way to hook into knockout's
	// subscription system without overriding their prototype
	var originalSubscribe = ko.subscribable.fn.subscribe;
	ko.subscribable.fn.subscribe = function (callback, callbackTarget, event) {
		var subscription = originalSubscribe.apply(this, arguments);
		
		if (event === watchEventName) {
			var target = this;
			
			var deepSub = koWatch(target, function (change) {
				target.notifySubscribers(change, watchEventName);
			});
			
			var originalDispose = subscription.dispose;
			subscription.dispose = function () {
				deepSub.dispose();
				originalDispose.call(subscription);
			};
		}
		
		return subscription;
	}
	
  /**
	 * Watch any change that occurs within any observable within the object hierarchy.
   * @param  {Boolean|Function} watchableOrSubscriber - If a boolean is passed it controls
	 * whether or not the observable is included in deep watches. If a function is passed
	 * it adds a deep watch subscription with the provided callback.
	 * @returns {Subscribable} The subscribable instance.
   */
	ko.subscribable.fn.watch = function (watchableOrSubscriber) {
		if (typeof watchableOrSubscriber === "function") {
			return this.subscribe(watchableOrSubscriber, null, watchEventName);
		}
		
		this[watchableToken] = !!watchableOrSubscriber;
		return this;
	};
	
	return ko;
}));
