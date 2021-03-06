JSSpeccy.Display = function(opts) {
	var self = {};
	
	var viewport = opts.viewport;
	var memory = opts.memory;
	var model = opts.model || JSSpeccy.Spectrum.MODEL_128K;
	var border = opts.border;
	var cpuFpsLimit = opts.cpuFpsLimit;

	var palette = new Int32Array([
		/* RGBA dark */
		0x000000ff,
		0x2030c0ff,
		0xc04010ff,
		0xc040c0ff,
		0x40b010ff,
		0x50c0b0ff,
		0xe0c010ff,
		0xc0c0c0ff,
		/* RGBA bright */
		0x000000ff,
		0x3040ffff,
		0xff4030ff,
		0xff70f0ff,
		0x50e010ff,
		0x50e0ffff,
		0xffe850ff,
		0xffffffff
	]);

	var testUint8 = new Uint8Array(new Uint16Array([0x8000]).buffer);
	var isLittleEndian = (testUint8[0] === 0);
	if(isLittleEndian) {
		/* need to reverse the byte ordering of palette */
		for(var i = 0; i < 16; i++) {
			var color = palette[i];
			palette[i] = ((color << 24) & 0xff000000) | ((color << 8) & 0xff0000) | ((color >>> 8) & 0xff00) | ((color >>> 24) & 0xff);
		}
	}


	var LEFT_BORDER_CHARS = Math.round(Math.min(Math.max(border, 0), 4));
	var RIGHT_BORDER_CHARS = Math.round(Math.min(Math.max(border, 0), 4));
	var TOP_BORDER_LINES = Math.round(Math.min(Math.max(border * 0.75, 0), 3) * 8);
	var BOTTOM_BORDER_LINES = Math.round(Math.min(Math.max(border * 0.75, 0), 3) * 8);
	var TSTATES_PER_CHAR = 4;
	
	var TSTATES_UNTIL_ORIGIN = model.tstatesUntilOrigin;
	var TSTATES_PER_SCANLINE = model.tstatesPerScanline;
	self.frameLength = model.frameLength;
	
	var Y_COUNT = 192, X_COUNT = 32, X_COUNT_8 = X_COUNT * 8;
  
	var BEAM_X_MAX = X_COUNT + (border ? RIGHT_BORDER_CHARS : 0);
	var BEAM_Y_MAX = Y_COUNT + (border ? BOTTOM_BORDER_LINES : 0);
	
	var CANVAS_WIDTH = X_COUNT_8 + (border ? ((LEFT_BORDER_CHARS + RIGHT_BORDER_CHARS) * 8) : 0);
	var CANVAS_HEIGHT = Y_COUNT + (border ? (TOP_BORDER_LINES + BOTTOM_BORDER_LINES) : 0);

	var
		vborder_cache, vborder_fill_count, vbitmap_cache,	vattr_cache,
		video_frame_count = 0,
		prev_timestamp = performance.now(),
		skipped_frames = 0;
    
	viewport.setResolution(CANVAS_WIDTH, CANVAS_HEIGHT);

  self.reset = function() {
    vborder_cache = -1;
    vborder_fill_count = 0;
		vbitmap_cache = new Uint8Array(X_COUNT * Y_COUNT);
		vattr_cache = new Uint8Array(X_COUNT * Y_COUNT);

		hqxReset();
  };
	hqxThreshold = 5;
	hqxOptions = {debugPrint: opts.debugPrint};
  
	var ctx, imageData, pixels, imageData2;
	var orig_w = viewport.canvas.width, orig_h = viewport.canvas.height;
	function init(filter_scale) {
		viewport.canvas.width = orig_w * filter_scale;
		viewport.canvas.height = orig_h * filter_scale;
		ctx = viewport.canvas.getContext("2d");
		ctx.globalAlpha = 1.0;
		imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
		pixels = new Int32Array(imageData.data.buffer);
		pixels.fill(0xFF000000);

		/* for post-processing */
		imageData2 = ctx.createImageData(filter_scale * CANVAS_WIDTH, filter_scale * CANVAS_HEIGHT);
		var pixels2 = new Int32Array(imageData2.data.buffer);
		pixels2.fill(0xFF000000);
		
		self.reset();
	}
	
	var checkerboardFilterEnabled = opts.settings.checkerboardFilter.get();
	opts.settings.checkerboardFilter.onChange.bind(function(newValue) {
		checkerboardFilterEnabled = newValue;
		init(checkerboardFilterEnabled ? 2 : 1);
		self.drawFullScreen();
	});	
	init(checkerboardFilterEnabled ? 2 : 1);
	
	var borderColour = 7;
	self.setBorder = function(val) {
		borderColour = val;
	};
	
	self.getBorder = function() {
		return borderColour;
	}
	
	var beamX, beamY; /* X character pos and Y pixel pos of beam at next screen event,
		relative to top left of non-border screen; negative / overlarge values are in the border */
	
	var pixelLineAddress; /* Address (relative to start of memory page) of the first screen byte in the current line */
	var attributeLineAddress; /* Address (relative to start of memory page) of the first attribute byte in the current line */
	var imageDataPos; /* offset into imageData buffer of current draw position */
	var currentLineStartTime;
	
	var flashPhase = 0;
	
	self.startFrame = function() {
		self.nextEventTime = currentLineStartTime = TSTATES_UNTIL_ORIGIN - (TOP_BORDER_LINES * TSTATES_PER_SCANLINE) - (LEFT_BORDER_CHARS * TSTATES_PER_CHAR);
		beamX = (border ? -LEFT_BORDER_CHARS : 0);
		beamY = (border ? -TOP_BORDER_LINES : 0);
		pixelLineAddress = 0x0000;
		attributeLineAddress = 0x1800;
		imageDataPos = 0;
		flashPhase = (flashPhase + 1) & 0x1f; /* FLASH has a period of 32 frames (16 on, 16 off) */
	};
	
	self.doEvent = function() {
    if (beamY < 0 | beamY >= Y_COUNT | beamX < 0 | beamX >= X_COUNT) {
      /* border */
      var color = palette[borderColour];
      if (vborder_cache == color) {
        imageDataPos += 8; // skip border fill
      }
      else {
        pixels[imageDataPos++] = color;
        pixels[imageDataPos++] = color;
        pixels[imageDataPos++] = color;
        pixels[imageDataPos++] = color;
        pixels[imageDataPos++] = color;
        pixels[imageDataPos++] = color;
        pixels[imageDataPos++] = color;
        pixels[imageDataPos++] = color;
        if (vborder_fill_count > 4 * CANVAS_WIDTH * CANVAS_HEIGHT / 8) { // wait for multiple border draw before use cache
          vborder_fill_count = 0;
          vborder_cache = color;  
        }
        else
        {
            vborder_fill_count++;            		
        }        
      }
    } else {
      /* main screen area */
      var pixelByte = memory.readScreen( pixelLineAddress | beamX );
      var attributeByte = memory.readScreen( attributeLineAddress | beamX );
      
      var cache_offs = beamX + beamY * X_COUNT;
      if (vbitmap_cache[cache_offs] == pixelByte && vattr_cache[cache_offs] == attributeByte) { 
        imageDataPos += 8; // skip repaint
      }
      else
      {
        vbitmap_cache[cache_offs] = pixelByte;
        vattr_cache[cache_offs] = attributeByte;
        
        var inkColor, paperColor;
        if ( (attributeByte & 0x80) && (flashPhase & 0x10) ) {
          /* FLASH: invert ink / paper */
          inkColor = palette[(attributeByte & 0x78) >> 3];
          paperColor = palette[(attributeByte & 0x07) | ((attributeByte & 0x40) >> 3)];
        } else {
          inkColor = palette[(attributeByte & 0x07) | ((attributeByte & 0x40) >> 3)];
          paperColor = palette[(attributeByte & 0x78) >> 3];
        }
        
        pixels[imageDataPos++] = (pixelByte & 0x80) ? inkColor : paperColor;
        pixels[imageDataPos++] = (pixelByte & 0x40) ? inkColor : paperColor;
        pixels[imageDataPos++] = (pixelByte & 0x20) ? inkColor : paperColor;
        pixels[imageDataPos++] = (pixelByte & 0x10) ? inkColor : paperColor;
        pixels[imageDataPos++] = (pixelByte & 0x08) ? inkColor : paperColor;
        pixels[imageDataPos++] = (pixelByte & 0x04) ? inkColor : paperColor;
        pixels[imageDataPos++] = (pixelByte & 0x02) ? inkColor : paperColor;
        pixels[imageDataPos++] = (pixelByte & 0x01) ? inkColor : paperColor;
      }
    }
    
		/* increment beam / nextEventTime for next event */
		beamX++;
		if (beamX < BEAM_X_MAX) {
			self.nextEventTime += TSTATES_PER_CHAR;
		} else {
			beamX = (border ? -LEFT_BORDER_CHARS : 0);
			beamY++;
			
			if (beamY >= 0 && beamY < 192) {
				/* pixel address = 0 0 0 y7 y6 y2 y1 y0 | y5 y4 y3 x4 x3 x2 x1 x0 */
				pixelLineAddress = ( (beamY & 0xc0) << 5 ) | ( (beamY & 0x07) << 8 ) | ( (beamY & 0x38) << 2 );
				/* attribute address = 0 0 0 1 1 0 y7 y6 | y5 y4 y3 x4 x3 x2 x1 x0 */
				attributeLineAddress = 0x1800 | ( (beamY & 0xf8) << 2 );
			}
			
			if (beamY < BEAM_Y_MAX) {
				currentLineStartTime += TSTATES_PER_SCANLINE;
				self.nextEventTime = currentLineStartTime;
			} else {
				self.nextEventTime = null;
			}
		}
	};
  
  var fps_limit = 25;
  var skipped_frames_limit = Math.ceil(cpuFpsLimit / fps_limit);
  var fps = 0;
  self.getFps = function() {
    return fps;
  };
  
  var updateFps = function(timestamp) {
    if (timestamp - prev_timestamp > 1000){
      fps = 1000.0 * (video_frame_count - skipped_frames) / (timestamp - prev_timestamp);
      prev_timestamp = timestamp;
      video_frame_count = 0;
      skipped_frames = 0;
    }      
  };
  
  var putImageData = function() {
    if (checkerboardFilterEnabled) {
      hqx(imageData, imageData2);
			ctx.putImageData(imageData2, 0, 0);
    } else {
      ctx.putImageData(imageData, 0, 0);
    }      
  };
  
	self.endFrame = function() {
    var timestamp = performance.now();   
    video_frame_count++;
    
    if ((video_frame_count % skipped_frames_limit) == 0) {
      updateFps(timestamp);
      putImageData();
    }
    else {
      skipped_frames++;
    }
	};

	self.drawFullScreen = function() {
		self.startFrame();
		while (self.nextEventTime) self.doEvent();
		self.endFrame();
	};

	return self;
};
