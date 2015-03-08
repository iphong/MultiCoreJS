void function() {

	var root = this;
	var MultiCore = root.MultiCore = function( n, f ) {
		return new Cluster(  n, f  );
	};

	var array = [];
	var slice = array.slice;

	var each = function (obj, iteratee, context) {
		var i, length;
		if (obj && typeof obj.length == 'number' && obj.length >= 0)
			for (i = 0, length = obj.length; i < length; i++)
				iteratee.call(context, obj[i], i, obj);
		else
			for (var key in obj)
				if (obj.hasOwnProperty(key))
					iteratee.call(context, obj[key], key, obj);
		return obj;
	};

	if (typeof root.document != 'undefined')
		var scriptPath = array.pop.call( document.getElementsByTagName('script') ).getAttribute('src');

	function Events() {

	};
	Events.prototype.on = function(name, callback, context) {
		this._events || (this._events = {});
		var events = this._events[name] || (this._events[name] = []);
		events.push({callback: callback, context: context, ctx: context || this});
		return this;
	};
	Events.prototype.trigger = function( name ) {
		var args = slice.call(arguments, 1);
		this._events || (this._events = {});
		each(this._events[name], function( event ) {
			event.callback.apply(event.ctx, args);
		});
		return this;
	};

	function Task( args ) {
		this.args = args;
	}
	Task.prototype = new Events;
	Task.prototype.start = function(handler) {
		this.on('start', handler);
		return this;
	};
	Task.prototype.done = function(handler) {
		this.on('success', handler);
		return this;
	};
	Task.prototype.error = function(handler) {
		this.on('error', handler);
		return this;
	};

	var Node = MultiCore.Node = function( fn ) {
		Object.defineProperty( this, 'fn', { value: fn } );
		this.worker = new Worker( scriptPath );
		this.tasks = [];
		this.paused = false;
		this.on('success', function() {
			this.reset();
			setTimeout(function() {
				delete this.active;
				this.next();
			}.bind(this));
		}  );
		this.on('error', function() {
			this.reset();
			setTimeout(function() {
				delete this.active;
				this.next();
			}.bind(this));
		} );
		this.init();
	};
	Node.prototype = new Events;
	Node.prototype.init = function() {
		var _this = this;
		this.worker.onmessage = function( e ) {
			var args = [];
			for (var key in e.data)
				args.push( e.data[key] );
			//console.log('CLIENT RECEIVED::', args);
			_this.trigger.apply( _this, args );
			!_this.active || _this.active.trigger.apply( _this.active, args );
		}
		this.emit('_init', this.fn.toString());
	};
	Node.prototype.reset = function() {
		this.worker.terminate();
		this.worker = new Worker( scriptPath );
		this.init();
	};
	Node.prototype.emit = function() {
		//console.log('CLIENT SENT::', arguments);
		this.worker.postMessage( slice.call(arguments) );
	};
	Node.prototype.queue = function() {
		var args = slice.call(arguments);
		var task = new Task(args);
		this.tasks.push(task);
		setTimeout(this.next.bind(this));
		this.trigger('queue', task);
		return task;
	};
	Node.prototype.exec = function() {
		var args = slice.call(arguments);
		var task = new Task(args);
		this.tasks.unshift(task);
		setTimeout(this.next.bind(this));
		this.trigger('exec', task);
		return task;
	};
	Node.prototype.next = function() {
		if (this.active || !this.tasks.length || this.paused)
			return;
		this.active = this.tasks.shift();
		this.emit.apply( this, ['_exec'].concat(this.active.args) );
		this.active.trigger('start', this);
		this.trigger('next');
	};
	Node.prototype.pause = function() {
		if (this.paused)
			return;
		this.trigger('pause');
		!this.active || this.active.trigger('pause');
		this.paused = true;
		this.tasks.unshift( this.active );
		delete this.active;
		this.reset();
		this.trigger('paused');
	};
	Node.prototype.resume = function() {
		if (!this.paused)
			return;
		this.trigger('resume');
		this.paused = false;
		this.next();
		this.trigger('resumed');
	};
	Node.prototype.clear = function() {
		while (this.tasks.length)
			this.tasks.pop();
		this.reset();
		delete this.active;
	};

	var Cluster = MultiCore.Cluster = function( num, fn ) {
		if (typeof num == 'function' && !fn) {
			var fn = num;
			var num = 1;
		}
		num > 0 || (num = 1);
		this.nodes = [];
		this.tasks = [];
		while (num-- > 0) {
			var node = new Node( fn );
			node.tasks = this.tasks;
			this.nodes.push(node);
		}
	};
	Cluster.prototype.queue = function() {
		var task = new Task( slice.call(arguments) );
		this.tasks.push(task);
		each(this.nodes, function(node) {
			setTimeout(node.next.bind(node));
		});
		return task;
	};
	Cluster.prototype.exec = function() {
		var task = new Task( slice.call(arguments) );
		this.tasks.unshift(task);
		each(this.nodes, function(node) {
			setTimeout(node.next.bind(node));
		});
		return task;
	};
	each([ 'pause', 'resume', 'clear' ], function( method ) {
		Cluster.prototype[ method ] = function() {
			var args = arguments;
			each(this.nodes, function(node) {
				node[ method ].apply( node, args);
			});
		}
	});


	if (typeof root.document == 'undefined') {
		var func;
		var node = new Events;
		node.emit = function() {
			//console.log('WORKER SENT::', arguments);
			root.postMessage( slice.call(arguments) );
		};
		node.done = function() {
			node.emit.apply( node, ['success'].concat( slice.call(arguments) ) );
		};
		root.onmessage = function( e ) {
			var args = [];
			for (var key in e.data)
				args.push( e.data[key] );
			//console.log('WORKER RECEIVED::', args);
			node.trigger.apply( node, args );
		};
		root.onerror = function( e ) {
			node.emit.apply( node, ['error'].concat( slice.call(arguments) ) );
		}
		node.on('_init', function( context ) {
			eval('func = '+ context +'');
		});
		node.on('_exec', function() {
			var result = func.apply( node, [].concat( slice.call(arguments), node.done) );
			result === undefined || node.done( result );
		});
	}

}.call( this );
