# multicore.js
Multithreads and queue task javascript library for browser

## How to use multicore.js
Simply include the js file on any page you may want to use:
```
<script src="multicore.js"></script>
```

Create a multicore cluster instance
```
var mc = MultiCore( 4, function( arg1, arg2... argN ){
	// Code in this function will be executed in
	// another cpu thread.
	...
	
	// Firing custom event useful for updating progress
	this.emit('custom-event', 'foo', ''bar );
	
	// Call this function anytime to successfully 
	// complete this task.
	this.done( result );
	
	// Return any value other than undefined
	// to successfully complete this task.
	// Don't return anything and use this.done()
	// if you are using asynchronous codes.
	return result;
});
```

Now add it to the queue stack so it can be executed
```
mc.queue( a, b )
	.on('start', function() {
		// Fired when this task is about to be executed
	})
	.on('done', function( result ) {
		// Fired when this task is completed successfully
	})
	.on('error', function( error ) {
		// Fired when there is an exception in the middle
		// of the call stack
	})
	.on('custom-event', function( arg1, arg2... argN ) {
		// Custom events can be fired anytime within the
		// call stack. Useful for updating progress.
	});
```

Call the above function as many times as you want. Multicore.js make sure that only N tasks is being executed simultenously and orderly.
