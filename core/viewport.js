JSSpeccy.Viewport = function(opts) {
	var self = {};
	var container = opts.container;	
	var panelXWidth = opts.panelXWidth || 0;
	var panelYWidth = opts.panelYWidth || 0;

	var positioner = document.createElement('div');
	container.appendChild(positioner);
	positioner.style.position = 'relative';

	self.canvas = document.createElement('canvas');
	positioner.appendChild(self.canvas);

	var statusIcon = document.createElement('div');
	positioner.appendChild(statusIcon);
	statusIcon.style.position = 'absolute';
	statusIcon.style.width = '64px';
	statusIcon.style.height = '64px';
	statusIcon.style.backgroundColor = 'rgba(127, 127, 127, 0.7)';
	statusIcon.style.borderRadius = '4px';
	statusIcon.style.backgroundPosition = 'center';
	statusIcon.style.backgroundRepeat = 'no-repeat';
	statusIcon.style.display = 'none';
	statusIcon.style.cursor = 'inherit';

	var currentIcon = 'none';
	self.showIcon = function(icon) {
		switch (icon) {
			case 'loading':
				statusIcon.style.display = 'block';
				statusIcon.style.backgroundImage = 'url(data:image/gif;base64,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)';
				statusIcon.style.cursor = 'inherit';
				break;
			case 'play':
				statusIcon.style.display = 'block';
				statusIcon.style.backgroundImage = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAclBMVEX///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8GMOiGAAAAJXRSTlMAeAIBJwX5egTIKvd0LMYl9W/AIfRpzrsf8WO3G+5fsRjtWKwWm6Sr4gAAAIBJREFUeF6l01sSgjAMhWEs3kBtFVRQ0NbLv/8tOm4g5yF5/mYyuZzqX8tVZdfiehCA9WZrA2haAdjtgw0gJgE4noINoOsF4HypbQDDKAC3e20DmGYBeDwFgFwE4PUWAD5fCVwtcnGNOc2uVQ+j69xd73q5mFxv37SO6Inwivj/AIKqMd+eZ3xLAAAAAElFTkSuQmCC)';
				statusIcon.style.cursor = 'pointer';
				break;
			default:
				statusIcon.style.display = 'none';
		}
	};
	if (opts.onClickIcon) {
		statusIcon.onclick = opts.onClickIcon;
	}

	self.setResolution = function(canvas_width, canvas_height) {	
		var devicePixelsCount = (window.screen.width > window.screen.height) ? window.screen.height - panelYWidth : window.screen.width - panelXWidth;  
		var width = Math.floor((devicePixelsCount / canvas_height) * canvas_width);
		var height = devicePixelsCount;
		var scale = Math.max(Math.max(width / window.screen.width, height / window.screen.height), 1);
		width = Math.floor(width / scale);
		height = Math.floor(height / scale);
		if (opts.debugPrint) {
			console.log("screen", window.screen.width, "x", window.screen.height, "calculated", width, "x", height, "scale", scale, "panelYWidth", panelYWidth);
		}
	
		container.style.width = width  + 'px';
		container.style.marginLeft = (- width / 2).toFixed(0)  + 'px';
			
		self.canvas.style.width = width + 'px';
		self.canvas.style.height = height + 'px';
		statusIcon.style.top = (height / 2 - 32).toFixed(0) + 'px';
		statusIcon.style.left = (width / 2 - 32).toFixed(0) + 'px';
		
		self.canvas.width = canvas_width;
		self.canvas.height = canvas_height;
	};
	
	self.container = function() {
		return container;
	};

	return self;
};
