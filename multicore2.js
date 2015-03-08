void function() {

	var root = this;
	var MultiCore = root.MultiCore = {};

	var array = [];
	var slice = array.slice;
	var each = function ( obj, iteratee, context ) {
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
	var extend = function( obj ) {
		slice.call( arguments, 1 ).forEach(function( o ) {
			for (var key in o)
				if (typeof o == 'object' && o.hasOwnProperty(key))
					obj[ key ] = o[ key ];
		});
		return obj;
	};
	var events = {
		on: function(name, callback, context) {
			this._events || (this._events = {});
			var events = this._events[name] || (this._events[name] = []);
			events.push({callback: callback, context: context, ctx: context || this});
			return this;
		},
		trigger: function( name ) {
			var args = slice.call(arguments, 1);
			this._events || (this._events = {});
			each(this._events[name], function( event ) {
				event.callback.apply(event.ctx, args);
			});
			return this;
		}
	};

	if (typeof root.document == 'undefined') {
		onmessage = function( e ) {
			switch (e.data[0]) {
				case 'execute':
					eval('var fn = ' + e.data[1]);
					postMessage([ 'success', fn.apply( null, e.data[2] ) ]);
					break;
				case 'spawn':
					var emit = function() {
						postMessage( slice.call(arguments) );
					};
					eval('(' + e.data[1] + ')').apply( null, e.data[2] );
					break;
			}
		};
		onerror = function( error ) {
			postMessage([ 'error', error ]);
		};
	}
	else
		var scriptPath = array.pop.call( document.getElementsByTagName('script') ).getAttribute('src');

	var Process = function( fn, args ) {
		this.worker = new Worker( scriptPath );
		this.worker.onmessage = function( e ) {
			var args = [];
			for (var key in e.data)
				args.push( e.data[key] );
			this.trigger.apply( this, args );
		}.bind(this);
		this.worker.postMessage([ 'spawn', fn.toString(), args ]);
		this.on('close', function() {
			console.log('Process closed.');
			this.worker.terminate();
		});
	};
	extend( Process.prototype, events, {
		close: function() {
			this.trigger('close');
		}
	});

	MultiCore.spawn = function( fn ) {
		return function() {
			return new Process( fn, slice.call(arguments) );
		}
	};

	MultiCore.exec = function( fn ) {
		return function() {
			var args = slice.call(arguments);
			return new Promise(function( resolve, reject ) {
				var worker = new Worker( scriptPath );
				worker.postMessage([ 'execute', fn.toString(), args ]);
				worker.onmessage = function( e ) {
					switch (e.data[0]) {
						case 'success':
							resolve( e.data[1] );
							break;
						case 'error':
							reject( e.data[1] );
							break;
					}
					worker.terminate();
				}
			})
		}
	};

}.call( this );