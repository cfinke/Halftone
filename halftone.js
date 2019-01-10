var properties = function () {
	return [
		{type: 'file-input', id: "Image" },
		{type: 'range', id: "Resolution", min: 2, max: 100, step: 1, value: 50 },
		{type: 'boolean', id: "Invert", value: false },
	];
};

var executor = function(args, success, failure) {
	var params = args.params;

	// executor() gets called as soon as the app loads, but there will be nothing to do.
	if (!params.Image) {
		return;
	}

	var material = args.material;

	// The image processing is done remotely due to the restrictions of doing it locally
	// in JavaScript without access to the DOM and Canvas.
	var req = new XMLHttpRequest();
	req.open("POST", "https://easel.efinke.com/halftone/", true);
	req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

	req.onreadystatechange = function () {
		if (req.readyState == XMLHttpRequest.DONE && req.status == 200) {
			var json = JSON.parse(req.responseText);

			if (!json) {
				failure("Unable to contact image processing server.");
				return;
			}

			if ("error" in json) {
				failure(json.error);
				return;
			}

			if (!("pixels" in json)) {
				failure("An unexpected error occurred.");
				return;
			}

			var square_size;
			
			// Determine if the material height or width is going to be the limiting factor.
			var image_ratio = json.size.width / json.size.height;
			var material_ratio = material.dimensions.x / material.dimensions.y;

			if ( image_ratio < material_ratio ) {
				square_size = material.dimensions.y / (json.size.height + 2);
			}
			else {
				square_size = material.dimensions.x / (json.size.width + 2);
			}

			var max_hole_size = square_size * 0.8; // This is arbitrary but seems to work well.

			var volumes = [];

			// Add no-op volumes to the corners so that everything is scaled properly.
			var corners = [ [0, 0], [0, json.size.height], [json.size.width, json.size.height], [json.size.width, 0] ];

			corners.forEach(function (corner) {
				volumes.push({ shape: { type: "ellipse", center: { x: square_size * (corner[0] + 1), y: square_size * (corner[1] + 1) }, flipping: {}, width: 0, height: 0, rotation: 0 }, cut: { depth: 0, type: 'fill' } });
			});

			for (var i = 0; i < json.pixels.length; i++) {
				var block = json.pixels[i];

				var hole_size;
				var hole_depth = material.dimensions.z;

				// The holes get wider for darker spots.
				if (params.Invert) {
					hole_size = max_hole_size * block.l;
				}
				else {
					hole_size = max_hole_size * (1 - block.l);
				}

				if (hole_size < 0.01) {
					continue;
				}

				volumes.push({
					shape: {
						type: "ellipse",
						center: {
							x: (1.5 + block.x) * square_size,
							// In images, 0,0 is the top left.
							// On the X-Carve, it's the bottom left.
							y: (json.size.height - (block.y) + 0.5) * square_size,
						},
						width: hole_size,
						height: hole_size,
						// These two properties are unused, but Easel breaks if you don't include them.
						// @see https://discuss.inventables.com/t/bug-easel-runs-my-executor-code-hundreds-of-times-per-second/42921/2
						flipping: {},
						rotation: 0,
					},
					cut: {
						depth: hole_depth,
						type: 'fill',
					}
				});
			}

			success(volumes);
		}
	};

	var request_params = "version=2.0.0";
	request_params += "&resolution=" + encodeURIComponent(params.Resolution);
	request_params += "&image=" + encodeURIComponent(params.Image);

	// Defined in config.private.js, a dependency.
	// request_params += "&api_key=" + API_KEY;

	req.send(request_params);
};
