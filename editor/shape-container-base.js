/*
    Contains common stuff like -

    a. Persistence (load/save) to JSON
    b. Read "interactions"

*/

App.Mode = {
    PLAYER : 0,
    EDITOR : 1
};
var ShapeContainerMixin = function() {};
ShapeContainerMixin.prototype = (function(jQuery) {

    // Attributes to make "hotspot" invisible at player mode
    var _hotspot_player_mode_attributes = {
        "fill-opacity": 0,
        "opacity": 0,
        cursor: "pointer"
    };

    var _meta_props = ["groupId", "templated", "pointedBy"];

    //*********************************************
    // Save functions
    //*********************************************

    var _is_composite_shape = function(shape) {

        if (typeof(shape.items) != 'undefined') {
            return true;
        }
        else {
            var superGroup = shape.getGroup();
		    return (typeof(superGroup) != 'undefined');
        }
    };

    var _get_super_group = function(shape) {
        if (typeof(shape.items) != 'undefined') {
            return shape;
        }
        else {
            var superGroup = shape.getGroup();
		    return (typeof(superGroup) != 'undefined') ? superGroup : null;
        }
    };

    /*
        Persist a shape
    */
	var _dumpshape = function(shape, shape_index)   {

        var attr = ("cx,cy,fill,fill-opacity,font,font-family,font-size,rotation" +
                    "font-weight,text-anchor,gradient,height,opacity,path,r," +
                    "rotation,rx,ry,src,stroke,stroke-dasharray,stroke-opacity,stroke-width,width,x,y,text").split(",");

		// Need to handle group-set
		var is_composite = _is_composite_shape(shape);
		if (is_composite) {

            var superGroup = _get_super_group(shape);
            var params = {

                // Type of this shape
				"composite-type": superGroup["composite-type"],

                // Z Order of this shape
                "z-order": shape_index,

                // Index of the the shape pointed to this shape
                "pointed-by": shape.pointedBy
			};

            if (superGroup.hasOwnProperty("elementalGroup") && superGroup.elementalGroup) {
                params["elementalGroup"] = superGroup.elementalGroup.id;
            }
			
			if (superGroup.hasOwnProperty("interactionId") && superGroup.interactionId) {
                params["interactionId"] = superGroup.interactionId;
            }
			
			return _dumpset(superGroup.shape, params);
		}
		else {

			// Normal case
			var info = {
                type: shape.type,
                id: shape.id,
                subtype: shape.subtype
			};

			for(var i = 0; i < attr.length; i++){
                var tmp = shape.attr(attr[i]);
                if(tmp) {
                    if(attr[i] == "path") {
                        tmp = tmp.toString();
                    }
                    info[attr[i]] = tmp;
                }
			}

			// Need to persist group_id for json decode
			if (shape.hasOwnProperty("groupId")) {
				info["groupId"] = shape["groupId"];
			}
			if (shape.hasOwnProperty("templated")) {
				info["templated"] = shape["templated"];
			}
            info["z-order"] = shape_index;
            info["pointed-by"] = shape.pointedBy;

            if (shape.hasOwnProperty("physics")) {
                info["physics"] = App.Utils.json_encode(shape["physics"]);
            }

			return info;
		}
	};

    // Handle nested cases as well
	var _dumpset = function(set, params) {
		if (typeof(set.items) != 'undefined') {
			var len = set.items.length;
			var arr = [];
			var info = {};
			for(var i = 0; i < len; ++i) {
				arr.push(_dumpset(set.items[i]));
			}
			info[set.id] = arr;
			if (typeof(params) != "undefined") {
				info["composite-type"] = params["composite-type"];
                info["z-order"] = params["z-order"];
                info["pointed-by"] = params["pointed-by"];
                info["elementalGroup"] = params["elementalGroup"];
				info["interactionId"] = params["interactionId"];
			}

			return info;
		}
		else {
			return _dumpshape(set);
		}
	};


    //*********************************************
    // Load functions
    //*********************************************
    var _loadShapeForPaper = function(paper, shape) {

        var newshape = null;

        if (typeof(shape.type) == 'undefined') {
            newshape = _loadSet(shape, paper);
        }
        else {
            var type = shape.type;
            newshape = paper[type]().attr(shape);

            newshape.id = shape ? shape.id : Raphael.createUUID();
            newshape.subtype = shape.subtype;

            if (shape.hasOwnProperty("pointed-by")) {
                newshape.pointedBy = shape["pointed-by"];
            }

            if (shape.hasOwnProperty("physics")) {
                newshape["physics"] = eval("(" + shape.physics + ")");
            }
        }

        return newshape;
    };

    var _loadSet = function(set, paper) {

		// Load type
		var layer = _loadSetInternal(set, paper);
		if (set.hasOwnProperty("composite-type")) {
			layer.group["composite-type"] = set["composite-type"];
		}
		if (set.hasOwnProperty("interactionId")) {
			layer.group["interactionId"] = set["interactionId"];
		}
        if (set.hasOwnProperty("pointed-by")) {
            layer.pointedBy = set["pointed-by"];
        }

		return layer;
	};

    var _loadSetInternal = function(set, draw) {

		var groupSet = {};
		var textSet = draw.set();
		var nonTextSet = draw.set();
		var templatedTextSet = [];
        var all_shapes = draw.set();

		// groupSet will be populated just like ImportSVG...
		// Duplication, I know, but we'll refactor later. Right now
		// the focus is on getting this DONE, not beauty.
		_parseShape(set, draw, groupSet, textSet, nonTextSet, templatedTextSet, all_shapes);


		// Use JSON object from set
		var first = _firstKey(set)[0];
		var rootSet = groupSet[first];

		//
		// NOTE:
		//
		//		Usually texts remain within some bounding box, and getBBox() has issues while dealing with
		//		text shapes. That's why we, here, differentiate between "nonTextSet" and "textSet". However, in some
		//		cases this assumption breaks down. One such case is "link", where an underline (path) is shown
		var bbox = null;
		if (set.hasOwnProperty("composite-type") && set["composite-type"] == 'link') {
			bbox = textSet[0].getBBox();
			bbox.height += 20;

			// NOTE:
			//		underline is a wierd case. We need to hook-up link
			textSet[0].uline = nonTextSet[0];

            templatedTextSet = [[textSet[0]]];
		}
		else {
			// Get the bounding box
			bbox = nonTextSet.items.length > 0 ? nonTextSet.getBBox() : textSet[0].getBBox();
		}


		// Draw the "layer" (invisible rect)
		var layer = draw.rect(bbox.x, bbox.y, bbox.width, bbox.height).attr({
						fill: "#FFF",
						"fill-opacity": 0,
						"stroke-opacity": 0,
						opacity: 0,
						cursor: "move",
						layer: true
				  });

		var superGroup = draw.set();
		superGroup.groupSet = true;
		superGroup.proxy = layer;
		superGroup.shape = rootSet;
		superGroup.wi = bbox.width;
		superGroup.hi = bbox.height;
		superGroup.id = Raphael.createUUID();

        // Hook up elemental
        if (set.hasOwnProperty("elementalGroup")) {
            superGroup.elementalGroup = groupSet[set["elementalGroup"]];
        }

		// Push the text set
		superGroup.textShapes = textSet;

		superGroup.nonTextSet = nonTextSet;

		superGroup.templatedTextSet = templatedTextSet;

        superGroup.all_shapes = all_shapes;

		superGroup.push(rootSet);
		superGroup.push(layer);
		layer.setGroup(superGroup);
		return layer;
	};

    var _firstKey = function(obj) {
		var firstGroupKey;
		for (firstGroupKey in obj) {
			if (obj.hasOwnProperty(firstGroupKey)) {
				break;
			}
		}
		return [firstGroupKey, obj[firstGroupKey]];
	};

    var _parseShape = function(shape, draw, groupSet, textSet, nonTextSet, templatedTextSet, all_shapes) {

		// Composite case
		if (typeof(shape.type) == 'undefined') {

			var first = _firstKey(shape);
			var key = first[0], val = first[1];

			// Create Rapheal group
			var thisGroup = draw.set();
			thisGroup.id = key;
			var childShape;
			jQuery(val).each(function(index, item) {
				childShape = _parseShape(item,
										draw,
										groupSet,
										textSet,
										nonTextSet,
										templatedTextSet,
                                        all_shapes);
				childShape["groupId"] = key;
				thisGroup.push(childShape);
			});
			groupSet[key] = thisGroup;
			return thisGroup;
		}
		else {

			// If we encounter a "grouped" object/hash
			if(shape.type == "rect"){
				newshape = draw.rect(0, 0,0, 0)
			}
			else if(shape.type == "path"){
				newshape = draw.path("")
			}
			else if(shape.type == "image"){
				newshape = draw.image(shape.src, 0, 0, 0, 0)
			}
			else if(shape.type == "ellipse"){
				newshape = draw.ellipse(0, 0, 0, 0)
			}
			else if(shape.type == "text"){
				newshape = draw.text(0, 0, shape.text);
				textSet.push(newshape);

				if (shape.hasOwnProperty("templated")) {
					newshape["templated"] = shape["templated"];
					var text_line_number = parseInt(shape["templated"]);
					if (typeof(templatedTextSet[text_line_number]) == "undefined") {
						templatedTextSet[text_line_number] = [];
					}
					templatedTextSet[text_line_number].push(newshape);
				}

			}

			newshape.attr(shape);

			// FIX the id uniqueness issue. generateUUID()
			newshape.id = shape.id;

			if (newshape.type != "text") {
				nonTextSet.push(newshape);
			}

            all_shapes.push(newshape);

			return newshape;
		}
	};

    // Return the common stuff
    return {

        DEFAULT_WIDTH: 840,

        containerElement: null,

        // Shapes data structure
        shapes: [],

        // Drawing surface
        draw: null,

        // Current page id selected to the container
        pageId: -1,

        // Page settings
        pageSettings: null,

        // App.Mode value
        viewMode: -1,

        // Physics world
        world: null,

        // Do we have physics object to run
        physicsEnabled: false,

        setCanvasWidth: function(width) {
            width = width || this.DEFAULT_WIDTH;

            if (this.containerElement) {
                this.containerElement.width(parseInt(width));
            }
        },

        // Serialize shapes
        serialize: function() {
            var self = this;
            return App.Utils.json_encode(jQuery.map(self.shapes, _dumpshape));
        },

        serialize_shapes: function(shapes) {
            var self = this;
            return App.Utils.json_encode(jQuery.map(shapes, _dumpshape));
        },

        // Clear the surface
        clear: function() {
            this.draw.clear();
        },

        // Given a proxy/handle, check whether this is a composite shape or not
        is_composite_shape: function(shape) {
            return _is_composite_shape(shape);
        },

        // Load shapes
        load: function(paper, shape_string, preview) {

            var self = this;

            // Initialize the world
            if (self.viewMode == App.Mode.PLAYER) {
                self.world = paper.world();
            }

            try {
                jQuery(shape_string).each(function(index, item){
                    var newshape = _loadShapeForPaper(paper, item);

                    // This is a Mixin. But unless we refactor the "loading" process with a callback (it's already done
                    // for PageHandler, but is not integrated with editor-ui), we've to to call "downward" classes this
                    // way
                    if (self.is_composite_shape(newshape) && self["makeWrappable"]) {
                        self.makeWrappable(newshape.getGroup());
                    }
                    else if (!self.is_composite_shape(newshape) && (self.world)) {

                        // Check for physics
                        if (newshape.physics) {

                            if (!self.physicsEnabled) {
                                self.physicsEnabled = true;
                            }

                            if (newshape.physics["body_type"]) {
                                switch(newshape.physics["body_type"]) {
                                    case "static":
                                        self.world.addStatic(newshape, {
                                            material: newshape.physics.material
                                        });
                                        break;
                                    case "dynamic":
                                        self.world.add(newshape, {
                                            behaviors : newshape.physics.behaviors,
                                            material: newshape.physics.material
                                        });
                                        break;
                                }
                            }

                            if (newshape.physics["background_image"]) {
                                self.world.addBackground(newshape);
                            }
                        }
                    }

                    // Add shape on Z-Order
                    //
                    // Don't add to shapes in case of preview
                    if (!preview) {
                        self.add_shape_simple(newshape, item["z-order"]);
                    }

                });
            }
            catch(err){
              App.Utils.log(err.message);
            }
        },

        // Add a shape to the container (simple). Doesn't contain
        // code specific to Undo etc.
        add_shape_simple: function(shape, index) {

            // Map the DOM to shape
            shape.node.shape_object = shape;

            if (index) {
                this.shapes[index] = shape;
            }
            else {
                this.shapes.push(shape);
            }
        },

        // Re-wire comments
        hookup_comments: function() {

            var self = this;
            jQuery(self.shapes).each(function(index, item) {

                // See that whether do we have a "pointed-by"
                if (item.hasOwnProperty("pointedBy")) {

                    // Get the index of the associated comment
                    var index_of_comment_shape = item.pointedBy;

                    // Get the comment shape
                    var comment = self.shapes[index_of_comment_shape];

                    // Join them
                    comment.joint(item);
                }
            })
        },

        // Change layering of the shape
        change_layering: function(selected, mode) {

            var self = this;

            var composite_shape = (typeof(selected.groupSet) != 'undefined');
            var shape = null;
            if (composite_shape) {
                shape = selected.proxy;
            }
            else {
                shape = selected;
            }
            switch(mode) {
                case "toback":

                    // Push to back - push
                    //
                    // NOTE:
                    //        Re-position the shape/layer to exact Z-Order
                    self.shapes.unshift(self.shapes.splice(self.shapes.indexOf(shape),1)[0]);

                    composite_shape ? selected.fixToBack() : selected.toBack();


                break;
                case "tofront":

                    // Push to font - Unshift
                    //
                    // NOTE:
                    //        Re-position the shape/layer to exact Z-Order
                    self.shapes.push(self.shapes.splice(self.shapes.indexOf(shape),1)[0]);

                    selected.toFront();
                break;
            }
        },

        // load viewers. Need raphael.sketchpad.js
        //
        // Assumption: Every '.mockup_viewer' should have a hidden field containing mockup JSON
        //
        // Usage :
        //          load_viewers(jQuery('.mockup_viewer'));
        load_preview: function($viewers, scale_parameters){

            var self = this;
            scale_parameters = scale_parameters || [110, 70, 0.15];

            if ($viewers.length <= 0) {
                return;
            }

            $viewers.each(function(index) {

                // Get mockup string
                var mockup_string = jQuery(this).prev().val();

                // Get preview size expected, if exists
                if (jQuery(this).siblings('.mockup_size').length > 0) {
                    scale_parameters = jQuery(this).siblings('.mockup_size').val().split(",")
                }

                if (!mockup_string) {
                    return true;
                }

                // This viewer
                var $viewer = jQuery(this);
                var sketchpad = null;

                // Check whether we have a "viewer" pad already stored
                if ($viewer.data("viewer")) {
                    sketchpad = $viewer.data("viewer");

                    // Clear any existing shapes
                    sketchpad.paper().clear();
                }
                else {

                    sketchpad = Raphael.sketchpad($viewer[0], {
                        width: scale_parameters[0],
                        height: scale_parameters[1],
                        editing: false
                    });

                    // Store the sketchpad for later access
                    $viewer.data("viewer", sketchpad);
                }

                // Get access to Rapheal object, often called "paper"
                var paper = sketchpad.paper();

                // Load the shapes
                //
                // Bad. Eval is bad way to de-serialize, I know.
                self.load(paper, eval("(" + mockup_string + ")"), true);

                // Scale now (earlier was inside sketchpad)
                paper.fitToScale(scale_parameters[2]);

                var _canvas = paper.canvas;
                jQuery(_canvas).css(
                    {
                        //'border': '1px solid',
                        'border-radius': '3px',
                        'margin-bottom': '5px',
                        'background-color': 'white'
                    })

            });
        },

		is_a_hotspot: function(selected) {
			return selected["composite-type"] == "hotspot";
		},

        hide_all_hotpots: function() {

            var container = this;
            jQuery(container.shapes).each(function(index, shape) {

                // Hotspot is a composite shape
                if (container.is_composite_shape(shape) && container.is_a_hotspot(shape.getGroup())) {
                    shape.getGroup().attr(_hotspot_player_mode_attributes);
                }
            });
        }

    };

})(jQuery);
