var ko = require("../");
var expect = require("chai").expect;

function assertTriggerCount (target, expected, inner) {
	var count = 0;
	ko.watch(target, function () { count++; });
	inner();
	expect(expected).to.equal(count);
}

describe("ko.watch specs", function () {
	describe("API", function () {
		it("ko should be defined", function () {
			expect(ko).to.be.defined;
		});

		it("watch should be defined", function () {
			expect(ko.watch).to.be.defined;
		});

		it("should have `watch` on subscribable prototype", function () {
			expect(ko.subscribable.fn.watch).to.be.defined;
		});

		it("can ignore per observable", function () {
			var foo = ko.observable(1).watch(false);
			var bar = {foo:foo};

			assertTriggerCount(bar, 0, function () {
				foo(2);
			});
		});

		it("can dispose subscription and cancel listening", function () {
			var foo = {bar:ko.observable(1)};
			var count = 0;

			var sub = ko.watch(foo, function () {
				count++;
			});

			sub.dispose();
			foo.bar(2);

			expect(count).to.equal(0);
		});
		
		it("should override subscribe", function () {
			var foo = ko.observable({bar:ko.observable(1)});
			var count = 0;
			
			foo.subscribe(function () { count++; }, null, "deep");
			foo().bar(2);
			
			expect(count).to.equal(1);
		});
		
		it("should allow disposal of returned subscription", function () {
			var foo = ko.observable({bar:ko.observable(1)});
			var count = 0;
			
			var sub = foo.subscribe(function () { count++; }, null, "deep");
			sub.dispose();
			foo().bar(2);
			
			expect(count).to.equal(0);
		});
		
		it("should allow watch to be used on an instance to deep subscribe", function () {
			var foo = ko.observable({bar:ko.observable(1)});
			var count = 0;
			
			foo.watch(function () { count++; });
			foo().bar(2);
			
			expect(count).to.equal(1);
		});
		
		it("should use shouldWatch to limit subscriptions", function () {
			var foo = ko.observable(1);
			var bar = ko.computed({ read: foo });
			var baz = {bar:bar};
			var count = 0;
			
			ko.watch(baz, function () { count++; }, { shouldWatch: ko.isWritableObservable });
			
			foo(2);
			
			expect(count).to.equal(0);
		});
		
		it("should use value from valueAccessor to add a subscription", function () {
			var underlyingObservable = ko.observable(1);
			var foo = Object.create({}, {
				bar: {
					enumerable: true,
					configurable: true,
					get: underlyingObservable,
					set: underlyingObservable
				}
			});
			
			var valueAccessor = function (value, key, parent) {
				if (!key || !parent || ko.isObservable(value)) {
					return value;
				}
				
				var descriptor = Object.getOwnPropertyDescriptor(parent, key);
				if ("get" in descriptor) {
					return descriptor.get;
				}
				
				return value;
			}
			
			var count = 0;
			
			ko.watch(foo, function () { count++; }, { valueAccessor: valueAccessor });
			
			underlyingObservable(2);
			expect(count).to.equal(1);
		});
		
		it("should allow default options to be overriden", function () {
			var foo = {bar:ko.observable(1)};
			
			var priorSubscriber = ko.watch.defaultOptions.shouldWatch;
			ko.watch.defaultOptions.shouldWatch = function() { return false; };
			
			assertTriggerCount(foo, 0, function () { 
				foo.bar(2); 
				ko.watch.defaultOptions.shouldWatch = priorSubscriber;
			});
		});
		
		it("should be able to pause updates on object", function () {
			var bar = ko.observable(1);
			var foo = {bar:bar};
			
			assertTriggerCount(foo, 2, function () {
				bar(2);
				
				bar.watch(false);
				bar(3);
				bar.watch(true);
				
				bar(4);
			});
		});
		
		it("should be able to pause updates on array", function () {
				var bar = ko.observableArray([1]);
				var foo = {bar:bar};
				
				assertTriggerCount(foo, 2, function () {
					bar.push(2);
					
					bar.watch(false);
					bar.push(3);
					bar.watch(true);
					
					bar.push(4);
				});
			});
	});

	describe("when watching objects", function () {
		it("should trigger a subscriber when an observable changes", function () {
			var foo = {
				bar: ko.observable(1)
			};

			assertTriggerCount(foo, 1, function () { foo.bar(2); });
		});

		it("should trigger subscriber deeply", function () {
			var foo = {bar:{baz:ko.observable(1)}};

			assertTriggerCount(foo, 1, function () { foo.bar.baz(2); });
		});

		it("should pass expected arguments to subscriber", function () {
			var foo = {
				bar: ko.observable(1)
			};

			var args;

			ko.watch(foo, function () {
				args = arguments[0];
			});

			foo.bar(2);

			expect(args.target).to.equal(foo.bar);
			expect(args.parent).to.equal(foo);
			expect(args.key).to.equal("bar");
			expect(args.value).to.equal(2);
			expect(args.priorValue).to.equal(1);
		});

		it("should watch the observable target if it is object", function () {
			var foo = {bar:ko.observable({baz:ko.observable(1)})};
			assertTriggerCount(foo, 1, function () { foo.bar().baz(2); });
		});

		it("should ignore circular references", function () {
			var foo = {bar:ko.observable()};
			foo.bar(foo);

			assertTriggerCount(foo, 1, function () { foo.bar(false); });
		});

		it("should preserve the priorValue", function () {
			var foo = {bar:ko.observable(1)};
			var values = [];

			ko.watch(foo, function (arg) { values.push(arg.priorValue); });

			foo.bar(2);
			foo.bar(3);
			foo.bar(4);

			expect(values).to.deep.equal([1,2,3]);
		});

		it("should stop watching when an observable value changes", function () {
			var foo = {bar:ko.observable({baz:ko.observable(1)})};

			assertTriggerCount(foo, 2, function () {
				var baz = foo.bar().baz;

				// should trigger
				baz(2);

				// should remove watching
				foo.bar({});

				// should not trigger
				baz(3);
			});
		});

		it("should watch new items that are added", function () {
			var foo = {bar:ko.observable()};

			assertTriggerCount(foo, 2, function () {
				var baz = {qux:ko.observable(1)};

				// should trigger
				foo.bar(baz);

				// should also trigger
				baz.qux(2);
			});
		});
		
		it("should watch observable it is passed in", function () {
			var foo = ko.observable(1);
			
			assertTriggerCount(foo, 1, function () {
				foo(2);
			});
		});
	});

	describe("when watching arrays", function () {
		it("should pass expected arguments to subscriber", function () {
			var foo = {
				bar: ko.observableArray([1])
			};

			var args;

			ko.watch(foo, function () {
				args = arguments[0];
			});

			foo.bar.push(2);

			expect(args.target).to.equal(foo.bar);
			expect(args.parent).to.equal(foo);
			expect(args.key).to.equal(1);
			expect(args.value).to.equal(2);
			expect(args.priorValue).to.be.undefined;
		});
		
		it("should notify when items are pushed", function () {
			var foo = {bar:ko.observableArray()};
			var item = {};
			var expected = {target:foo.bar,parent:foo,key:0,priorValue:undefined,value:item};
			var actual;

			ko.watch(foo, function (arg) {
				actual = arg;
			});

			foo.bar.push(item);
			expect(actual.value).to.equal(expected.value);
		});

		it("should notify when items are deleted", function () {
			var item = {};
			var foo = {bar:ko.observableArray([item])};
			var expected = {target:foo.bar,parent:foo,key:0,priorValue:item,value:undefined};
			var actual;

			ko.watch(foo, function (arg) {
				actual = arg;
			});

			foo.bar.remove(item);
			expect(actual.priorValue).to.equal(expected.priorValue);
		});

		it("should watch objects within array", function () {
			var item = {baz:ko.observable(1)};
			var foo = {bar:ko.observableArray([item])};
			var expected = {target:item.baz,parent:item,key:"baz",priorValue:1,value:2};
			var actual;

			ko.watch(foo, function (arg) {
				actual = arg;
			});

			item.baz(2);
			expect(actual.value).to.equal(expected.value);
		});

		it("should watch items added to the array", function () {
			var item = {baz:ko.observable(1)};
			var foo = {bar:ko.observableArray()};

			assertTriggerCount(foo, 2, function () {
				// first trigger
				foo.bar.push(item);

				// second trigger
				item.baz(2);
			});
		});

		it("should stop watching items removed from the array", function () {
			var item = {baz:ko.observable(1)};
			var foo = {bar:ko.observableArray([item])};

			assertTriggerCount(foo, 1, function () {
				// first trigger
				foo.bar.remove(item);

				// should not trigger
				item.baz(2);
			});
		});

		it("should notify subscriber of moves", function () {
			var item1 = "one";
			var item2 = "two";
			var foo = {bar:ko.observableArray([item1,item2])};
			var args = [];

			ko.watch(foo, function (arg) {
				args.push(arg);
			});

			foo.bar.reverse();

			expect(args.length).to.equal(2);
			args.sort(function (a, b) { return a.key - b.key; });

			expect(args[0].value).to.equal(item2);
			expect(args[0].priorValue).to.equal(item1);

			expect(args[1].value).to.equal(item1);
			expect(args[1].priorValue).to.equal(item2);
		});
		
		it("should watch items in plain array", function () {
			var foo = {bar:[ko.observable(1),ko.observable(1)]};
			
			assertTriggerCount(foo, 1, function () {
				foo.bar[0](2)
			});
		});
	});
});