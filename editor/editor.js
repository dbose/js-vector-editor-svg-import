/*
    Core editor
*/
App.Editor = function(elem, width, height) {

    if (typeof(Raphael) != "function") { //check for the renderer
      return alert("Error! Renderer is Missing!"); //if renderer isn't there, return false;
    }

    /* The DOM element on which Raphael paper is drawn */
    this.container = elem;
    this.containerElement = jQuery(this.container);

    /* The Raphael paper  */
    this.draw = Raphael(elem, width, height);

    /* Put a reference of the editor back into Raphael paper  */
    this.draw.editor = this;

    /*
        Temporary structures for offsets, mouse-delta
    */
    this.onHitXY = [0,0];
    this.offsetXY = [0,0];
    this.tmpXY = [0,0];
    this.deltaXY = [-1,-1];
    this.scaleXY = [-1,-1];


    /*
        Various drawing defaults for the editor. This should go to a UI settings dialog and should be saved
        on per app basis
    */
    this.prop = {
        "src": "http://upload.wikimedia.org/wikipedia/commons/a/a5/ComplexSinInATimeAxe.gif",
        "height": 100,
        "width": 100,
        "stroke-width": 2,
        "stroke": "#000000",
        "fill": "#000",
        "stroke-opacity": 1,
        "fill-opacity": 1,
        "text": "Text",
        "font-family": "Comic Sans MS",
        "font-size": 14,
        "text-anchor": "start",
        "raw": null
    };

    // Mode drives the action editor currently performs or will perform
    this.mode = "select";

    // SelectBox, denotes the the box used for Group-Selection
    this.selectbox = null;

    // Core structure to keep pointers of selected shapes. For composite shapes, this contains one or many "groups"(s)
    this.selected = []

    // After Mode, this also decides any mode-specific action the editor performs
    this.action = "";

    // Used to denote the Shift+, "Add to Select" mode
    this.selectadd = false;

    // Used for when Group-Selection is ON.  See, this.selectbox as well.
    this.groupselect = false;
    this.beingcloned = false;

    // Core structure, which keep pointers to editor shapes. For composite shapes, this contains one or many
    // "layer" (s)
    this.shapes = [];

    // Core structure, which holds various "tracker" (a Raphael set, drawn to mark a specific shape)
    this.trackers = [];

    this.listeners = {};

    // Clipboard
    this.clipboard = null;

    // Stack for Undo
    //this.undoHistory = [];
    this.undoManager = new App.UndoManager(this);

    // Textbox, which is used to edit various shapes' textblocks
    this.textBoxInput = (function() {

                            var textBox = jQuery("<textarea/>");
                            textBox.css({
                                "z-index" : 2,
                                "position" : "absolute",
                                "rows": 6,
                                "height": '150px',
                                "width": '300px',
                                "autofocus": "autofocus"
                            });
                            jQuery("body").append(textBox);
                            textBox.hide();
                            return textBox;

                        })();
    this.rowDelimiter = "\n";
    this.columnDelimiter = ",";

    // Dictionary of various in-built shapes
    this.builtin_shapes = {          
    };
    var draw = this.draw;

    this.viewMode = App.Mode.EDITOR;

    // Hold wrappable shapes with text
    this.wrappable = ["webui_tooltip", "webui_textarea"];

    this.mobilesafari = /AppleWebKit.*Mobile/.test(navigator.userAgent);

    // Offset of the drawing container relative to the window
    this.offset = function(){

        if(window.jQuery){
          var pos = jQuery(elem).offset();
          return [pos.left, pos.top];
        }

        return [0,0];
    };

    // Utility functions go here
    this.utils = {
        array: function (a){
            for(var b=a.length,c=[];b--;)
                c.push(a[b]);
            return c;
        }
    };
};
App.Editor.prototype = (function(jQuery) {

    var self = null;

    var bind = function(fn, scope){
        return function(){
            return fn.apply(scope, scope.utils.array(arguments));
        };
    };

    return {

        _setMode: function(mode){

            self = this;

            self.lastmode = mode;
            self.fire("setmode",mode);

            if(mode == "select+") {
                self.mode = "select";
                self.selectadd = true;
                self.unselect();
            }
            else if(mode == "select") {
                self.mode = mode;
                self.unselect();
                self.selectadd = false;
            }
            else if(mode == "delete") {
                self.deleteSelection();
                self.mode = "select";
            }
            else {
                self.unselect();
                self.mode = mode;
            }

        },

        init: function() {

            self = this;

            var copy_handler = function() {
                self.beingcloned = true;
                self.copy_to_clipboard();
            };

            var _paste_handler = function() {

                if (self.clipboard && !self.beingcloned) {
                    self.load(self.draw, eval("("+ self.clipboard + ")"));
                    this.clipboard = null;
                }
                else if (self.beingcloned) {
                    self.clone();
                    self.beingcloned = false;
                }

            };

            var _delete_handler = function(e) {
                self.setMode('delete');
                e.preventDefault();
            };

            var _keyboard_move_handler = function(e) {
                var len = self.selected.length;

                if (len == 0) {
                    return;
                }

                for(var i = 0; i < len; ++i) {

                    switch(e.data) {
                        case "up":
                            self.move(self.selected[i], 0, -2);
                            break;
                        case "down":
                            self.move(self.selected[i], 0, 2);
                            break;
                        case "left":
                            self.move(self.selected[i], -2, 0);
                            break;
                        case "right":
                            self.move(self.selected[i], 2, 0);
                    }

                    self.updateTracker();
                }
            };

            var _undo_handler = function(e) {

                // UNDO handler
                self.undoManager.undoHandler(e);
            };

            // Mouse handlers
            var _add_mouse_handlers = function() {
                if(jQuery){

                    var offset = self.offset();

                    jQuery(self.container).mousedown(bind(function(event){
                        event.preventDefault();

                        if(event.button == 2){
                            self.setMode("select") //tempselect
                        }
                        self.onMouseDown(event.pageX - offset[0], event.pageY - offset[1], event.target)
                    }, self));

                    jQuery(self.container).mousemove(bind(function(event){
                        event.preventDefault();
                        self.onMouseMove(event.pageX - offset[0], event.pageY - offset[1], event.target)
                    }, self));

                    jQuery(self.container).mouseup(bind(function(event){
                        event.preventDefault();
                        self.onMouseUp(event.pageX - offset[0], event.pageY - offset[1], event.target)
                    }, self));

                    jQuery(self.container).double_click(bind(function(event){
                        event.preventDefault();
                        self.onDblClick(event.pageX - offset[0], event.pageY - offset[1], event.target)
                    }, self));

                    if(this.mobilesafari){

                        self.container.addEventListener("touchstart", bind(function(event){
                          event.preventDefault();
                          self.onMouseDown(event.touches[0].pageX - offset[0], event.touches[0].pageY - offset[1], event.target)
                        }, self) ,false);

                        self.container.addEventListener("touchmove", bind(function(event){
                          event.preventDefault();
                          self.onMouseMove(event.touches[0].pageX - offset[0], event.touches[0].pageY - offset[1], event.target)
                        }, self), false);

                        self.container.addEventListener("touchend", bind(function(event){
                          event.preventDefault();
                          self.onMouseUp(0, 0, event.target)
                        }, self), false);

                        self.container.addEventListener("selectstart", function(event){
                          event.preventDefault();
                          return false
                        }, false);
                    }
                }
            };

            var _add_keyboard_handlers = function() {
                jQuery(document).live('keydown', 'ctrl+c', copy_handler);
                jQuery(document).live('keydown', 'meta+c', copy_handler);
                jQuery(document).live('keydown', 'ctrl+v', _paste_handler);
                jQuery(document).live('keydown', 'meta+v', _paste_handler);
                jQuery(document).live('keydown', 'backspace', _delete_handler);
                jQuery(document).live('keydown', 'del', _delete_handler);
                jQuery(document).live('keydown', 'ctrl+z', _undo_handler);

                jQuery(document).live('keydown', 'up', _keyboard_move_handler);
                jQuery(document).live('keydown', 'down', _keyboard_move_handler);
                jQuery(document).live('keydown', 'left', _keyboard_move_handler);
                jQuery(document).live('keydown', 'right', _keyboard_move_handler);
            };

            // Attach handlers
            _add_keyboard_handlers();
            _add_mouse_handlers();
        },

        setMode: function(mode){
            if(mode == "text"){

                this._setMode('text');
                self.onMouseDown(100, 100, jQuery('#canvas').children()[0]);
                this._setMode('select');
                return;
            }
            else if(mode == "image"){
                //self.prop.src = prompt("Image Source URL:",self.prop.src)
            }
            
            this._setMode(mode=='selectp'?'select+':mode);
        },

        arrange: function(mode) {
            var selected = this.selected[0];
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
                    this.shapes.unshift(this.shapes.splice(this.shapes.indexOf(shape),1)[0]);

                    composite_shape ? selected.fixToBack() : selected.toBack();

                    //selected.shape[0].toBack();
                    break;
                case "tofront":

                    // Push to font - Unshift
                    //
                    // NOTE:
                    //        Re-position the shape/layer to exact Z-Order
                    this.shapes.push(this.shapes.splice(this.shapes.indexOf(shape),1)[0]);

                    selected.toFront();
                    break;
            }
        },

        on: function(event, callback){
            if(!this.listeners[event]) {
                this.listeners[event] = [];
            }

            if(this.in_array(callback,this.listeners[event])  ==  -1){
                this.listeners[event].push(callback);
            }
        },

        returnRotatedPoint: function(x,y,cx,cy,a){
            // http://mathforum.org/library/drmath/view/63184.html

            // radius using distance formula
            var r = Math.sqrt((x-cx)*(x-cx) + (y-cy)*(y-cy));
            // initial angle in relation to center
            var iA = Math.atan2((y-cy),(x-cx)) * (180/Math.PI);

            var nx = r * Math.cos((a + iA)/(180/Math.PI));
            var ny = r * Math.sin((a + iA)/(180/Math.PI));

            return [cx+nx,cy+ny];
        },

        fire: function(event) {
            if(this.listeners[event]){
                for(var i = 0; i < this.listeners[event].length; i++){
                  if(this.listeners[event][i].apply(this, arguments)===false){
                    return false;
                  }
                }
            }
        },

        un: function(event, callback){
            if(!this.listeners[event])
                return;
            var index = 0;
            while((index = this.in_array(callback,this.listeners[event])) != -1){
                this.listeners[event].splice(index,1);
            }
        },

        in_array: function(v,a){
            for(var i=a.length;i--&&a[i]!=v;);
            return i;
        },

        array_remove: function(e, o){
            var x=this.in_array(e,o);
            x!=-1?o.splice(x,1):0
        },

        is_selected: function(shape){
            return this.in_array(shape, this.selected) != -1;
        },

        set_attr: function(){
            for(var i = 0; i < this.selected.length; i++){
                this.selected[i].attr.apply(this.selected[i], arguments);
            }
        },

        set: function(name, value){
            //this.prop[name] = value;
            this.set_attr(name, value);
        },

        addBuiltInShape: function(shape_token, x, y) {
            this.setMode(shape_token);
            this.onMouseDown(x, y, this.container);
            this.setMode("select");
        },

        addImage: function(file, x, y) {
            this.prop.src = file;
            this.setMode('image');
            this.onMouseDown(x, y, this.container);
            this.setMode("select");
        },

        /*
            Adds a rectangular hotspot. Later this function will be re-factored to add other kind of hotspots like
            "loop" etc.
        */
        addHotSpot: function(e) {

            var x,y;

            if (!e) {
                x = 100; y = 100;
            }
            else {
                var offset = this.offset();
                x = e.pageX - offset[0]; y = e.pageY - offset[1];
            }

            this.addBuiltInShape("hotspot", x, y);
        },

        markAsStatic: function(immovable) {

            if (this.selected.length == 0) {
                return;
            }

            // Not supported for Composite Shapes (as of now)
            if (typeof(this.selected[0].groupSet) != 'undefined') {
                return;
            }

            var shape = this.selected[0];

            // Marks sure physics object exist
            shape.physics = shape.physics || {};
            shape.physics["body_type"] = immovable ? "static" : "dynamic";
            
            $('#canvas').trigger("shapeSelected"); //FIXME: This is a bad hack
        },

        markAsBackground: function() {

            if (this.selected.length == 0) {
                return;
            }

            // Not supported for Composite Shapes (as of now)
            if (typeof(this.selected[0].groupSet) != 'undefined') {
                return;
            }

            var shape = this.selected[0];

            if (shape.type != "image") {
                return;
            }

            shape.physics = shape.physics || {};
            shape.physics["background_image"] = shape.attr("src");
        },

        addTexture: function() {

            if (this.selected.length == 0) {
                return;
            }

            // Not supported for Composite Shapes (as of now)
            if (typeof(this.selected[0].groupSet) != 'undefined') {
                return;
            }

            var shape = this.selected[0];

            var imagePicker = new App.ImagePicker(function(file) {
                shape.attr("fill", "url(" + file.url + ")");
            });
            imagePicker.show();
        },

        addBehavior: function(shape, type, behavior) {

            shape.physics = shape.physics || {};
            shape.physics.behaviors = shape.physics.behaviors || {};

            if (type == "collision") {

                if (!shape.physics.behaviors[type]) {
                    shape.physics.behaviors[type] = [];
                }
                shape.physics.behaviors[type].push(behavior);
            }
            else {
                shape.physics.behaviors[type] = behavior;
            }
        },

        getBehavior: function(shape, type) {

            if (!shape) {
                return null;
            }

            if (shape.physics && shape.physics.behaviors) {
                return shape.physics.behaviors[type];
            }

            return null;
        },

        addMaterialType: function(shape, material) {

            shape.physics = shape.physics || {};
            shape.physics.material = material;
        },

        getMaterialType: function(shape) {
            if (!shape) {
                return null;
            }

            if (shape.physics && shape.physics.material) {
                return shape.physics.material;
            }

            return null;
        },

        getAllMaterialTypes: function() {

            var materials = [],
                shapes = this.shapes
                len = shapes.length,
                shape = null;

            for(var i = 0 ; i < len ; i++){
                shape = shapes[i];
                if (shape && shape.physics && shape.physics.material) {
                    materials.push(shape.physics.material);
                }
            }

            return materials;
        },

        fromString: function(textInput) {

            // Make sure we still have the selection
            if (this.selected.length == 0) {
                return;
            }

            // Make sure we've a composite shape in our hand
            if (typeof(this.selected[0].groupSet) == 'undefined') {

                // Check for text
                if (this.selected[0].type == 'text') {

                    this.selected[0].attr('text', textInput);

                }

                return;
            }
            else if (this.isWrappable(this.selected[0])) {
                this.selected[0].primaryText.attr("text", textInput);
                this.adjustForTextInput(this.selected[0], this.selected[0].primaryText);
                return;
            }

            var composite_shape = this.selected[0],
                editor = this;

            // Get lines (row delimiter)
            var lines = textInput.split(editor.rowDelimiter);

            // Split each line based on column delimiter
            jQuery.each(lines, function(index, value) {
                lines[index] = value.split(editor.columnDelimiter);
            });

            // Flatten the 2D array
            /*
            lines = jQuery.map(lines, function(n) {
                return n;
            });*/

            // Now the order of text should match the templatedTextSet array
            // of our "groupedSet"

            var templatedTextSet = composite_shape.templatedTextSet;


            // Go through each text-shapes references
            try {
                jQuery.each(templatedTextSet, function(line_number, line) {
                    jQuery.each(line, function(index, textShape) {
                        textShape.attr('text', lines[line_number][index] || "");

                        editor.adjustForTextInput(composite_shape, textShape);
                    });
                });
            }
            catch(e) {}

            // Invoke post-serialization hook. See Raphael.st.afterTextSerialization
            this.afterTextSerialization(composite_shape,
                                        false,
                                        {
                                            "lines": lines
                                        });

        },


        /*
            This will be called for a number of shapes (composite/set) after their textual content is persisted

            shape:  composite shape
            draw:  	true, if being drawn first-time
                    false, if being updated

            NOTE:
                this["composite-type"] will be used to differentiate between various composite shapes and take
                relevant actions
        */
        afterTextSerialization: function(shape, first_time, params) {

            //Verify whether this shape is a compsite-shape defined by us
            if (typeof(shape["composite-type"]) == "undefined") {
                return;
            }

            var type = shape["composite-type"],superGroup = shape;
            switch(type) {
                case "link":
                    // Implicit assumption that link will have one text element
                    var link = superGroup.templatedTextSet[0][0];

                    if (first_time) {
                        link.underline(true, {
                            "stroke": "#3333FF",
                            "fill":   "#FFFFFF"
                        });
                        superGroup.shape.push(link.uline);
                        superGroup.nonTextSet.push(link.uline);
                    }
                    else {

                        // Remove the existing underline "gracefully"
                        var _set = superGroup.shape;
                        var uline = _set.items.splice(1, 1);
                        uline[0].remove();
                        link.uline = null;

                        // Redraw it. I find "redrawing" more easier than "scaling"
                        link.underline(true, {
                            "stroke": "#3333FF",
                            "fill": "#FFFFFF"
                        });
                        _set.push(link.uline);

                        // Update links
                        superGroup.shape = superGroup.all_shapes = _set;
                    }
                    break;
                case "webui_radio_button":
                case "webui_checkbox":

                    // Check for the presence of * in the text
                    var option = superGroup.templatedTextSet[0][0],
                        option_text = option.attr("text"),
                        selected = false;

                    if (option_text && option_text[0] == "*") {
                        selected = true;
                        option.attr("text", option_text.substring(1));
                    }

                    selected ? superGroup.shape[1].show() : superGroup.shape[1].hide();
                    break;

                case "webui_accordian":

                    if (!first_time) {
                        var lines = params["lines"];

                        if (lines.length > superGroup.templatedTextSet.length) {

                            /* Add Case */

                            // New panels added
                            var new_panels_to_create = (lines.length - superGroup.templatedTextSet.length),
                                panel_index = 0,
                                newPanel = null,
                                elemental_bbox = superGroup.elementalGroup.getBBox(),
                                offset = elemental_bbox.height - 5,
                                currXY = {x: elemental_bbox.x, y: elemental_bbox.y},
                                targetXY = {
                                                x: elemental_bbox.x,
                                                y: (elemental_bbox.y +
                                                   superGroup.templatedTextSet.length * offset)
                                };

                            while (panel_index < new_panels_to_create) {

                                // Need to create additional accordian panels
                                newPanel = this.draw.cloneSet(superGroup.elementalGroup);

                                // Update text
                                newPanel[1].attr("text", lines[superGroup.templatedTextSet.length + panel_index]);

                                // Move the panel to appropriate places
                                this.move(newPanel, targetXY.x - currXY.x, targetXY.y - currXY.y);

                                // Add the panel to respective data structures
                                superGroup.addGroup(newPanel, true);

                                // Update targetXY
                                targetXY.y += offset;

                                panel_index++;
                            }


                        }
                        else if (lines.length < superGroup.templatedTextSet.length) {

                            /* Remove case */

                        }
                    }


                    // 1. Iterate over all templated text set
                    break;

                case "webui_tabs":

                    if (!first_time) {
                        var lines = params["lines"];

                        if (lines[0].length > superGroup.templatedTextSet[0].length) {

                            // New panels added
                            var new_tabs_to_create = (lines[0].length - superGroup.templatedTextSet[0].length),
                                tab_index = 0,
                                newTab = null;


                                elemental_bbox = superGroup.elementalGroup.getBBox(),
                                offset = elemental_bbox.width - 5,
                                currXY = {x: elemental_bbox.x, y: elemental_bbox.y},
                                targetXY = {
                                    x: (elemental_bbox.x + (superGroup.templatedTextSet[0].length - 1) * offset),
                                    y: elemental_bbox.y
                                };

                            while (tab_index < new_tabs_to_create) {

                                // Need to create additional tabs
                                newTab = this.draw.cloneSet(superGroup.elementalGroup);

                                // Update text
                                newTab[1].attr("text", lines[0][superGroup.templatedTextSet[0].length + tab_index]);

                                // Move the panel to appropriate places
                                this.move(newTab, targetXY.x - currXY.x, targetXY.y - currXY.y);

                                // Add the panel to respective data structures
                                superGroup.addGroup(newTab, false);

                                // Update targetXY
                                targetXY.x += offset;

                                tab_index++;
                            }

                        }
                    }

                    break;

                case "webui_tooltip":
                case "webui_textarea":

                    if (first_time) {
                        this.makeWrappable(superGroup);
                    }
                    break;

            }

            // Upate the dimension of the "transparent proxy"
            this.updateGroupLayer(superGroup, superGroup.getBBox());

        },

        /*
            Updates the superGroup and layer after a re-draw
        */
        updateGroupLayer: function(shape, bbox) {

            //Verify whether this shape is a compsite-shape defined by us
            if (typeof(shape["composite-type"]) == "undefined") {
                // A normal Raphael set. Ignore.
                return;
            }

            var type = shape["composite-type"],
                superGroup = shape,
                layer = superGroup.proxy;

            // Resize the layer
            layer.attr({
                x: 		bbox.x,
                y: 		bbox.y,
                width:  bbox.width,
                height: bbox.height
            });
        },

        /*
            Adjusts the composite shape's size based on the text shape
        */
        adjustForTextInput: function(composite_shape, text_shape) {

            var container_bbox = composite_shape.nonTextSet.getBBox(),
                text_bbox = text_shape.getBBox(),
                text_offset = (text_bbox.x - container_bbox.x);

            // Check whether width has grown big or not?
            if (text_bbox.width > container_bbox.width) {
                this.resizeCompositeShape(composite_shape,
                                            text_bbox.width + text_offset + 20,
                                            container_bbox.height);

                // Update the tracker
                this.newTracker(composite_shape);
            }
        },

        isWrappable: function(composite_shape) {
            return (this.in_array(composite_shape["composite-type"], this.wrappable) != -1);
        },

        makeWrappable: function(composite_shape) {

            composite_shape.wrappable = true;

            switch(composite_shape["composite-type"]) {

                case "webui_tooltip":
                case "webui_textarea":
                    composite_shape.primaryText = composite_shape[0][1];
                    break;
            }
        },

        toInputString: function() {

            // Make sure we still have the selection
            if (this.selected.length == 0) {
                return;
            }

            var shape = this.selected[0];

            // Make sure we've a composite shape in our hand
            if (typeof(shape.groupSet) == 'undefined') {

                // Check for text
                if (shape.type == 'text') {

                    return shape.attr('text');
                }
                else {
                    return;
                }

            }
            else if (this.isWrappable(shape)) {
                return shape.primaryText.attr("text");
            }

            // Templatable text shapes
            var str = "";
            var templatedTextSet = this.selected[0].templatedTextSet;
            jQuery.each(templatedTextSet, function(line_number, line) {
                jQuery.each(line, function(index, textShape) {
                    str += textShape.attr('text');
                    str += editor.columnDelimiter;
                });
                str += editor.rowDelimiter;
            });

            return str.replace(/[,\n]+$/g,'');
        },

        onMouseDown: function(x, y, target, attr){
            this.fire("mousedown")

            // Hide textinput, if visible
            if (this.textBoxInput && this.textBoxInput.is(':visible')) {
              this.fromString(this.textBoxInput.val());
              this.textBoxInput.attr("tabindex",-1).blur().hide();
            }

            this.tmpXY = this.onHitXY = [x,y];

            if(this.mode == "select" && !this.selectbox) {

                var shape_object = null
                if (this.groupselect && this.selected.length > 0) {
                    this.action = "move";
                    return;
                }
                else if(target.shape_object && !target.is_tracker){
                    shape_object = target.shape_object
                }else if(target.parentNode.shape_object && !target.is_tracker){
                    shape_object = target.parentNode.shape_object
                }else if(!target.is_tracker){
                    if(!this.selectadd) this.unselect();
                    this.selectbox = this.draw.rect(x, y, 0, 0)
                    .attr({"fill-opacity": 0.15,
                          "stroke-opacity": 0.5,
                          "fill": "#007fff", //mah fav kolur!
                          "stroke": "#007fff"});
                    return;
                }
                else {

                    // Trackers
                    if (target.shape_object) {
                        if ((this.scaleXY[0] < 0) && (this.scaleXY[1] < 0)) {
                            var bbox = target.shape_object.getBBox();
                            this.scaleXY[0] = bbox.width; this.scaleXY[1] = bbox.height;
                        }
                    }

                    return; //die trackers die!
                }


                if(this.selectadd){
                  this.selectAdd(shape_object);
                  this.action = "move";
                }
                else if(!this.is_selected(shape_object)){
                  this.select(shape_object);
                  this.action = "move";
                }else{
                  this.action = "move";
                }

                if ((this.deltaXY[0] < 0) && (this.deltaXY[1] < 0)) {
                    this.deltaXY[0] = x; this.deltaXY[1] = y;
                }

                this.offsetXY = [shape_object.attr("x") - x,shape_object.attr("y") - y]

            }
            else if(this.mode == "delete" && !this.selectbox) {
                var shape_object = null
                if(target.shape_object){
                  shape_object = target.shape_object
                }else if(target.parentNode.shape_object){
                  shape_object = target.parentNode.shape_object
                }else if(!target.is_tracker){
                  this.selectbox = this.draw.rect(x, y, 0, 0)
                    .attr({"fill-opacity": 0.15,
                          "stroke-opacity": 0.5,
                          "fill": "#ff0000", //oh noes! its red and gonna asplodes!
                          "stroke": "#ff0000"});
                  return;
                }else{
                  return; //likely tracker
                }
                this.deleteShape(shape_object)
                this.offsetXY = [shape_object.attr("x") - x,shape_object.attr("y") - y]
            }
            else if(this.selected.length == 0 && !this.selectbox) {
                var shape = null;

                if(this.mode == "rect"){

                    shape = this.draw.rect(x, y, 100, 100);

                }
                else if(this.mode == "ellipse"){

                    shape = this.draw.ellipse(x, y, 50, 50);

                }
                else if(this.mode == "path"){

                    shape = this.draw.path("M{0},{1}",x,y);

                }
                else if(this.mode == "line"){

                    shape = this.draw.path("M{0},{1}",x,y)
                    shape.subtype = "line"

                }
                else if(this.mode == "polygon"){

                    shape = this.draw.path("M{0},{1}",x,y)
                    shape.polypoints = [[x,y]]
                    shape.subtype = "polygon"

                }
                else if(this.mode == "image"){

                    shape = this.draw.image(this.prop.src, x, y, editor.prop.width, editor.prop.height);

                }
                else if(this.mode == "text"){

                    shape = this.draw.text(x, y, this.prop['text']).attr('font-size',this.prop['font-size']);
                    shape.text = this.prop['text'];

                }
                else if (this.mode == "link") {

                    shape = this.draw.createUnderLine(x, y, {
                        'text': this.prop['text'],
                        'font-size': this.prop['font-size']
                    })

                }
                else if (this.mode == "svg") {

                    // Handle SVG
                    shape = this.draw.importSVG(prompt('Paste your raw SVG data here:'), {
                        "stroke": this.prop.stroke,
                        "stroke-width": this.prop["stroke-width"],
                        "fill": this.prop.fill,
                        "fill-opacity": this.prop['fill-opacity'],
                        "stroke-opacity": this.prop["stroke-opacity"]
                    });

                }
                else if (this.mode == "svg-raw") {

                    // Handle SVG
                    shape = this.draw.importSVG(this.prop.raw, {
                        "stroke": this.prop.stroke,
                        "stroke-width": this.prop["stroke-width"],
                        "fill": this.prop.fill,
                        "fill-opacity": this.prop['fill-opacity'],
                        "stroke-opacity": this.prop["stroke-opacity"]
                    });

                }
                else {
                    shape = this.draw.importSVG(this.builtin_shapes[this.mode], {
                        "stroke": this.prop.stroke,
                        "stroke-width": this.prop["stroke-width"],
                        "fill": this.prop.fill,
                        "fill-opacity": this.prop['fill-opacity'],
                        "stroke-opacity": this.prop["stroke-opacity"],
                        "font-family": this.prop["font-family"]
                    });

                    // Store a tag/type in the actual composite shape. Remember the the structure is like below
                    //
                    //  superGroup (A Raphael Set) --------(shape)---------> A Raphael Set (containing nested shapes)
                    //			|
                    //			|
                    //  		|------------------(proxy)--------> A Raphael Rect denoting a transparent
                    //			^									"layer" (as returned from importSVG)
                    //			|											|
                    //			|											|
                    //			|-------------------(group)-----------------|
                    //
                    shape.group["composite-type"] = this.mode;

                    // Invoke additional actions
                    this.afterTextSerialization(shape.group, true);

                    var bbox = shape.group.getBBox();
                    shape.group.translate(x - bbox.x, y - bbox.y);
                }

                if(shape){
                    shape.id = this.generateUUID();


                    shape.attr({
                    "fill": attr ? attr["fill"] : this.prop.fill,
                    "fill-opacity": attr ? attr["fill-opacity"] : this.prop["fill-opacity"],
                    "stroke": attr ? attr["stroke"] : this.prop.stroke,
                    "stroke-width": attr ? attr["stroke-width"] : this.prop["stroke-width"],
                    "stroke-opacity": attr ? attr["stroke-opacity"] : this.prop["stroke-opacity"],
                    "text": attr ? attr["text"] : this.prop["text"],
                    "text-anchor": attr ? attr["text-anchor"] : this.prop["text-anchor"],
                    "font-size": attr ? attr["font-size"] : this.prop["font-size"],
                    "font-family": attr ? attr["font-family"] : this.prop["font-family"]
                    });
                    this.addShape(shape)
                }
            }
            else{
            }
            return false;
        },

        onMouseMove: function(x, y, target){

            this.fire("mousemove")
            if(((this.selected.length > 0) || (this.selectbox)) && (this.mode == "select" || this.mode == "delete")){
            if(this.selectbox){
              this.resize(this.selectbox, x - this.onHitXY[0], y - this.onHitXY[1], this.onHitXY[0], this.onHitXY[1])
            }else if(this.mode == "select"){
              if(this.action == "move"){
                for(var i = 0; i < this.selected.length; i++){
                  this.move(this.selected[i], x - this.tmpXY[0], y - this.tmpXY[1])
                }
                //this.moveTracker(x - this.tmpXY[0], y - this.tmpXY[1])
                this.updateTracker();
                this.tmpXY = [x, y];

              }else if(this.action == "rotate"){
                //no multi-rotate
                var box = this.selected[0].getBBox()
                var rad = Math.atan2(y - (box.y + box.height/2), x - (box.x + box.width/2))
                var deg = ((((rad * (180/Math.PI))+90) % 360)+360) % 360;

                if (typeof(this.selected[0].groupSet) != "undefined") {
                    this.selected[0].rotate(deg,(box.x + box.width/2), (box.y + box.height/2));
                }
                else {
                    this.selected[0].rotate(deg, true); //absolute!
                }

                //this.rotateTracker(deg, (box.x + box.width/2), (box.y + box.height/2))
                this.updateTracker();
              }else if(this.action.substr(0,4) == "path"){
                var num = parseInt(this.action.substr(4))
                var pathsplit = Raphael.parsePathString(this.selected[0].attr("path"))
                if(pathsplit[num]){
                  pathsplit[num][1] = x
                  pathsplit[num][2] = y
                  this.selected[0].attr("path", pathsplit)
                  this.updateTracker()
                }
              }else if(this.action == "resize"){
                if(!this.onGrabXY){ //technically a misnomer
                  if (typeof(this.selected[0].groupSet) != "undefined") {
                     this.onGrabXY = [
                      this.selected[0].getBBox().x,
                      this.selected[0].getBBox().y,
                      this.selected[0].getBBox().width,
                      this.selected[0].getBBox().height
                    ]
                  }
                  else if(this.selected[0].type == "ellipse"){
                      this.onGrabXY = [
                        this.selected[0].attr("cx"),
                        this.selected[0].attr("cy")
                      ]
                  }
                  else if(this.selected[0].type == "path"){
                    this.onGrabXY = [
                      this.selected[0].getBBox().x,
                      this.selected[0].getBBox().y,
                      this.selected[0].getBBox().width,
                      this.selected[0].getBBox().height
                    ]
                  }
                  else{
                    this.onGrabXY = [
                      this.selected[0].attr("x"),
                      this.selected[0].attr("y")
                    ]
                  }
                  //this.onGrabBox = this.selected[0].getBBox()
                }
                var box = this.selected[0].getBBox()
                a = this.selected[0].groupSet ? -this.selected[0].proxy.attr("rotation") : -this.selected[0].attr("rotation");
                var nxy = this.returnRotatedPoint(x, y, box.x + box.width/2, box.y + box.height/2, a)
                //x = nxy[0] - 5
                //y = nxy[1] - 5
                if((this.selected[0].type == "rect")||(typeof(this.selected[0].groupSet) != "undefined")) {
                  if (typeof(this.selected[0].groupSet) != "undefined") {
                    this.resize(this.selected[0], x - this.onGrabXY[0], y - this.onGrabXY[1], this.onGrabXY[2], this.onGrabXY[3])
                  }
                  else {
                    this.resize(this.selected[0], x - this.onGrabXY[0], y - this.onGrabXY[1], this.onGrabXY[0], this.onGrabXY[1])
                  }

                }else if(this.selected[0].type == "image"){
                  this.resize(this.selected[0], x - this.onGrabXY[0], y - this.onGrabXY[1], this.onGrabXY[0], this.onGrabXY[1])
                }else if(this.selected[0].type == "ellipse"){
                  this.resize(this.selected[0], x - this.onGrabXY[0], y - this.onGrabXY[1], this.onGrabXY[0], this.onGrabXY[1])
                }else if(this.selected[0].type == "text"){
                  this.resize(this.selected[0], x - this.onGrabXY[0], y - this.onGrabXY[1], this.onGrabXY[0], this.onGrabXY[1])
                }else if(this.selected[0].type == "path"){
                  this.selected[0].scale((x - this.onGrabXY[0])/this.onGrabXY[2], (y - this.onGrabXY[1])/this.onGrabXY[3], this.onGrabXY[0], this.onGrabXY[1])
                }
                this.newTracker(this.selected[0])
              }
            }
            }else if(this.selected.length == 1){
                if(this.mode == "rect"){
                  this.resize(this.selected[0], x - this.onHitXY[0], y - this.onHitXY[1], this.onHitXY[0], this.onHitXY[1])
                }else if(this.mode == "image"){
                  this.resize(this.selected[0], x - this.onHitXY[0], y - this.onHitXY[1], this.onHitXY[0], this.onHitXY[1])
                }else if(this.mode == "ellipse"){
                  this.resize(this.selected[0], x - this.onHitXY[0], y - this.onHitXY[1], this.onHitXY[0], this.onHitXY[1])
                }else if(this.mode == "text"){
                  this.resize(this.selected[0], x - this.onHitXY[0], y - this.onHitXY[1], this.onHitXY[0], this.onHitXY[1])
                }else if(this.mode == "path"){
                  //this.selected[0].lineTo(x, y);
                  this.selected[0].attr({
                      "path": this.selected[0].attrs.path + 'L'+x+' '+y,
                      "fill": "none"
                  })
                }else if(this.mode == "polygon" || this.mode == "line"){
                  //this.selected[0].path[this.selected[0].path.length - 1].arg[0] = x
                  //this.selected[0].path[this.selected[0].path.length - 1].arg[1] = y
                  //this.selected[0].redraw();
                  //var pathsplit = this.selected[0].attr("path").split(" ");

                  //theres a few freaky bugs that happen due to this new IE capable way that is probably better

                  var pathsplit = Raphael.parsePathString(this.selected[0].attr("path"))
                  if(pathsplit.length > 1){
                    //var hack = pathsplit.reverse().slice(3).reverse().join(" ")+' ';

                    //console.log(pathsplit)
                    if(this.mode == "line"){
                      //safety measure, the next should work, but in practice, no
                      pathsplit.splice(1)
                    }else{
                      var last = pathsplit[pathsplit.length -1];
                      //console.log(this.selected[0].polypoints.length, pathsplit.length)
                      if(this.selected[0].polypoints.length < pathsplit.length){
                      //if(Math.floor(last[1]) == this.lastpointsX && Math.floor(last[2]) == this.lastpointsY){
                        pathsplit.splice(pathsplit.length - 1, 1);
                        }
                      //}else{
                      //  console.log(last[1], last[2], this.lastpointsX, this.lastpointsY)
                      //}
                    }
                    //this.lastpointsX = x; //TO FIX A NASTY UGLY BUG
                    //this.lastpointsY = y; //SERIOUSLY

                    this.selected[0].attr("path", pathsplit.toString() + 'L'+x+' '+y)

                  }else{
                    //console.debug(pathsplit)
                    //normally when this executes there's somethign strange that happened
                    this.selected[0].attr("path", this.selected[0].attrs.path + 'L'+x+' '+y)
                  }
                  //this.selected[0].lineTo(x, y)
                }
            }

            return false;
        },

        getMarkup: function(){
            return this.draw.canvas.parentNode.innerHTML;
        },

        copy_to_clipboard: function() {
            var select_count = this.selected.length;
            var cloned_shape = null;

            // NOTE:
            //      addShape will change the this.selected array. So we should make a copy of that array and iterate

            //var selected_copy = this.utils.array(this.selected);
            this.clipboard = this.serialize_shapes(this.selected);
        },

        clone: function() {

            var select_count = this.selected.length;
            var cloned_shape = null;

            // NOTE:
            //      addShape will change the this.selected array. So we should make a copy of that array and iterate

            var selected_copy = this.utils.array(this.selected);
            for(var i = 0; i < select_count; i++) {

                if (typeof(selected_copy[i].groupSet) != 'undefined') {
                    cloned_shape = this.draw.copy(selected_copy[i]);

                    // Make a small +x, +y translation to show the copy
                    cloned_shape.group.translate(10, 10);
                }
                else {
                    cloned_shape = selected_copy[i].clone();

                    // Make a small +x, +y translation to show the copy
                    cloned_shape.translate(10, 10);
                }

                cloned_shape.id = this.generateUUID();
                this.addShape(cloned_shape);
            }

            if (cloned_shape) {
                this.select(cloned_shape);
            }
        },

        onDblClick: function(x, y, target){
            this.fire("dblclick")

            if(this.selected.length == 1){

                if(this.selected[0].getBBox().height == 0 && this.selected[0].getBBox().width == 0){
                  this.deleteShape(this.selected[0])
                }

                if(this.mode == "polygon"){
                  //this.selected[0].andClose()
                  this.unselect()
                }
                
                //handle double click on hotspot
                if(this.is_a_hotspot(this.selected[0])) {
                   jQuery(".add_interaction.btn").click(); //trigger interaction button click
                   return false;
                }
                
                // Show the text input for text-parametrization
                if ((typeof(this.selected[0].groupSet) != "undefined") || (this.selected[0].type == "text")) {
                    var bbox = this.selected[0].getBBox(); // should cache this on select?

                    // Need to handle offset of the canvas
                    var offset = this.offset();
                    // Show the text over here
                    this.textBoxInput.css({"left":bbox.x+offset[0], "top":bbox.y+offset[1]});
                    this.textBoxInput.val(this.toInputString());
                    this.textBoxInput.show();
                    this.textBoxInput.focus();
                }
            }
            return false;
        },

        onMouseUp: function(x, y, target){
            this.fire("mouseup")
            this.onGrabXY = null;

            if(this.mode == "select" || this.mode == "delete"){

                try{
                    if (!((this.deltaXY[0] < 0) && (this.deltaXY[1] < 0))) {
                        this.deltaXY[0] = x - this.deltaXY[0];
                        this.deltaXY[1] = y - this.deltaXY[1];
                        this.undoManager.move(target.shape_object, this.deltaXY[0], this.deltaXY[1]);
                        this.deltaXY[0] = -1; this.deltaXY[1] = -1;
                    }
                }
                catch(e) {}


                if(this.selectbox) {
                  var sbox = this.selectbox.getBBox();
                  var new_selected = [];
                  for(var i = 0; i < this.shapes.length; i++){
                    if(this.rectsIntersect(this.shapes[i].getBBox(), sbox)){
                      new_selected.push(this.shapes[i])
                    }
                  }

                  if(new_selected.length == 0 || this.selectadd == false){
                    this.unselect()
                  }

                  if(new_selected.length == 1 && this.selectadd == false){
                    this.select(new_selected[0])
                  }else{
                    for(var i = 0; i < new_selected.length; i++){
                      this.selectAdd(new_selected[i])
                    }
                    this.groupselect = true;
                    this.action = "";
                  }
                  if(this.selectbox.node.parentNode){
                    this.selectbox.remove()
                  }
                  this.selectbox = null;

                  if(this.mode == "delete"){
                    this.deleteSelection();
                  }

                }
                else if (this.groupselect == true) {
                    this.unselect();
                    this.groupselect = false;
                }
                else{

                    if (this.action == "move") {

                    }
                    else if (this.action == "resize") {

                        if (target.shape_object) {
                            console.log(this.scaleXY);
                            console.log(target.shape_object.getBBox());
                            if (!((this.scaleXY[0] < 0) && (this.scaleXY[1] < 0))) {
                                this.undoManager.scale(target.shape_object, this.scaleXY[0], this.scaleXY[1]);
                                this.scaleXY[0] = -1; this.scaleXY[1] = -1;
                            }
                        }

                    }

                    this.action = "";
                }
            }
            else if(this.selected.length == 1){
                if(this.selected[0].getBBox().height == 0 && this.selected[0].getBBox().width == 0){
                  if(this.selected[0].subtype != "polygon"){
                    this.deleteShape(this.selected[0])
                  }
                }

                if(this.mode == "rect"){
                  this.unselect()
                }else if(this.mode == "ellipse"){
                  this.unselect()
                }else if(this.mode == "path"){
                  this.unselect()
                }else if(this.mode == "line"){
                  this.unselect()
                }else if(this.mode == "image"){
                  this.unselect()
                }else if(this.mode == "text"){
                  this.unselect()
                }else if(this.mode == "polygon"){
                    //this.selected[0].lineTo(x, y)
                  this.selected[0].attr("path", this.selected[0].attrs.path + 'L'+x+' '+y)
                  if(!this.selected[0].polypoints) this.selected[0].polypoints = [];
                  this.selected[0].polypoints.push([x,y])

                }
            }

            if(this.lastmode){

            if ((this.lastmode != 'select') & ((this.mode != 'path') && (this.mode != 'line'))) {
                this.setMode("select");
            }

            //this.setMode(this.lastmode);
            //this.mode = this.lastmode //not selectmode becasue that unselects
            //delete this.lastmode;
            }
            return false;
        },

        deleteSelection: function(){
          while(this.selected.length > 0){
            this.deleteShape(this.selected[0])
          }
        },

        deleteShape: function(shape,nofire, no_undo){
            if(!nofire){if(this.fire("delete",shape)===false)return;}

            // Remove from other data structures
            //
            // Our "layer" is added to the "shape" attribute of tracker
            for(var i = 0; i < this.trackers.length; i++){

            if (this.isLayer(this.trackers[i].shape)) {
                var groupSet = this.getGroupSet(this.trackers[i].shape);
                if (groupSet == shape) {
                    this.removeTracker(this.trackers[i]);
                }
            }
            else {
                if(this.trackers[i].shape == shape){
                  this.removeTracker(this.trackers[i]);
                }
            }

            }

            // Remove from the "shapes" data structure
            if (typeof(shape.groupSet) != 'undefined') {
            var layer = shape.proxy;
            for(var i = 0; i < this.shapes.length; i++){
                if(this.shapes[i] == layer){
                    this.shapes.splice(i, 1)
                }
             }
            }
            else {
                for(var i = 0; i < this.shapes.length; i++){
                    if(this.shapes[i] == shape){
                      this.shapes.splice(i, 1)
                    }
                  }
            }

            // Remove from "selected" data structure
            //

            // If "layer" is passed as a shape, extract out the actual "groupSet" which is added
            // to the selected array
            if (this.isLayer(shape)) {
            shape = this.getGroupSet(shape);
            }
            for(var i = 0; i < this.selected.length; i++){
            if(this.selected[i] == shape){
                this.selected.splice(i, 1)
            }
            }

            if (!no_undo) {
               // Undo DELETE
               this.undoManager.deleteShape(shape);
            }


            // Remove from Rapheal UI
            //
            // Typically our "groupSet" will be passed as a "selected" shape
            if (typeof(shape.groupSet) != 'undefined') {
                //Remove the embedd set
                shape.remove();
            }
            else {
            if(shape && shape.node && shape.node.parentNode){
                shape.remove();
              }
            }

        },

        deleteAll: function(){
            this.fire("clear2");

            this.draw.clear();
            this.shapes = [];
            this.trackers = [];
        },

        clearShapes: function(){
            this.fire("clear");
            while(this.shapes.length > 0){
                this.deleteShape(this.shapes[0],true) //nofire
            }
        },

        generateUUID: function(){
            return Raphael.createUUID();
        },

        getShapeById: function(v){
            for(var i=this.shapes.length;i--&&this.shapes[i].id!=v;);
            return this.shapes[i];
        },

        addShape: function(shape,no_select, no_fire, no_undo, index) {
            if(!no_fire)this.fire("addshape",shape,no_select);


            if (!no_undo) {

                // ADD
                shape = this.undoManager.addShape(shape);
            }

            shape.node.shape_object = shape;
            if(!no_select){
            this.selected = [shape]
            }

            if (index) {
            this.shapes[index] = shape;
            }
            else {
            this.shapes.push(shape);
            }


            if(!no_fire)this.fire("addedshape",shape,no_select);

            return shape;
        },

        rectsIntersect: function(r1, r2) {
            return r2.x < (r1.x+r1.width) &&
                  (r2.x+r2.width) > r1.x &&
                  r2.y < (r1.y+r1.height) &&
                  (r2.y+r2.height) > r1.y;
        },

        drawGrid: function(){
          //this.draw.drawGrid(0, 0, 480, 272, 10, 10, "blue").toBack();
        },

        move: function(shape, x, y){

            // Set case
            if (shape.items) {
                for(var i = 0; i < shape.items.length; ++i) {
                   this.move(shape.items[i], x, y);
                }
            }
            else {
                shape.translate(x,y);
            }
        },

        scale: function(shape, corner, x, y){
            var xp = 0, yp = 0
            var box = shape.getBBox()
            switch(corner){
            case "tr":
              xp = box.x
              yp = box.y + box.height
              break;
            case "bl":
              xp = box.x + box.width
              yp = box.y
              break;
            case "tl":
              xp = box.x + box.width;
              yp = box.y + box.height;
            break;
            case "br":
              xp = box.x
              yp = box.y
            break;
            }
            shape.scale(x, y, xp, yp)
        },

        resizeCompositeShape: function(object, width, height) {

            if (object["composite-type"] == 'link') {

                // NOTE:
                //          Not allowing links to scale now.

            }
            else {
                var textShapes = object.textShapes;

                var bb = object.getBBox();
                var cx = bb.x;
                var cy = bb.y;

                var w = (width > 0) ? width : cx + width;
                var h = (height > 0) ? height : cy + height;
                var x_factor = Math.abs((w)/object.wi);
                var y_factor = Math.abs((h)/object.hi);
                object.scale(x_factor, y_factor, cx, cy);



                if (textShapes.items.length > 0) {
                    var textShapesNumber = textShapes.items.length;
                    var textShape = null;
                    for(var i = 0; i < textShapesNumber; ++i) {
                        textShape = textShapes.items[i];
                        textShape.scaleToContainer(x_factor,
                                                   y_factor,
                                                    cx,
                                                    cy,
                                                    bb);
                    }
                }

                // Wrap, if the composite shape is wrappable
                if (this.isWrappable(object)) {
                    var s = object.primaryText;
                    s.attr("text", s.attr("text").split("\n").join("")).wrap(w - 10);
                }
            }

        },

        resize: function(object, width, height, x, y){
            if (object.groupSet) {
                this.resizeCompositeShape(object, width, height);
            }
            else {
                if(object.type == "rect" || object.type == "image"){
                    if(width > 0){
                      object.attr("width", width)
                    }else{
                      object.attr("x", (x?x:object.attr("x"))+width)
                      object.attr("width", Math.abs(width))
                    }
                    if(height > 0){
                      object.attr("height", height)
                    }else{
                      object.attr("y", (y?y:object.attr("y"))+height)
                      object.attr("height", Math.abs(height))
                    }
                }else if(object.type == "ellipse"){
                    if(width > 0){
                      object.attr("rx", width)
                    }else{
                      object.attr("x", (x?x:object.attr("x"))+width)
                      object.attr("rx", Math.abs(width))
                    }
                    if(height > 0){
                      object.attr("ry", height)
                    }else{
                      object.attr("y", (y?y:object.attr("y"))+height)
                      object.attr("ry", Math.abs(height))
                    }
                }else if(object.type == "text"){
                    object.attr("font-size", Math.abs(width))
                    //object.node.style.fontSize = null;
                }
            }
        },

        isLayer: function(shape) {
            return (typeof(shape.group) != 'undefined');
        },

        getGroupSet: function(shape) {
            return shape.getGroup();
        },

        unselect: function(shape){

          if(!shape){
            while(this.selected[0]){
              this.unselect(this.selected[0])
            }
            if(shape !== false){
              this.fire("unselected")
            }
          }else{
            this.fire("unselect", shape);
            this.array_remove(shape, this.selected);
            for(var i = 0; i < this.trackers.length; i++){


              //NOTE:
              //        For groupSet, we've patched the select() method to add the "super group" set as
              //        selected element. However, for showTracker(), which injects the ".shape" token to trackers remain
              //        pointed to the "layer" (fake) rectangle
              if (this.isLayer(this.trackers[i].shape)) {
                var groupSet = this.getGroupSet(this.trackers[i].shape);
                if (groupSet == shape) {
                    this.removeTracker(this.trackers[i]);
                }
              }
              else {
                if(this.trackers[i].shape == shape){
                    this.removeTracker(this.trackers[i]);
                }
              }

            }
            
            $('#canvas').trigger("shapeUnselected"); //FIXME: This hack is used to hide properties panel through editor ui
          }
        },

        selectAdd: function(shape){
            if(this.is_selected(shape) == false){
            if(this.fire("selectadd",shape)===false)return;

            var groupSet = shape.getGroup();
            this.selected.push((groupSet != null) ? groupSet : shape);
            this.showGroupTracker(shape);
            }
        },

        selectAll: function(){
            this.unselect()
            for(var i = 0; i < this.shapes.length; i++){
            this.selectAdd(this.shapes[i])

            }
        },

        selectToggle: function(shape){
            if(this.is_selected(shape) == false){
                this.selectAdd(shape)
            }
            else{
                this.unselect(shape)
            }
        },

        select: function(shape){
            if(this.fire("select",shape)===false)return;
            this.unselect(false)

            // Need to account for GroupSet (dropped by ImportSVG)
            var groupSet = shape.getGroup();
            this.selected = (groupSet != null) ? [groupSet] : [shape];
            this.showTracker(shape);
            
            $('#canvas').trigger("shapeSelected"); //FIXME: This hack is used to show properties panel through editor ui
        },

        removeTracker: function(tracker){
            if(!tracker){
                while(this.trackers.length > 0){
                  this.removeTracker(this.trackers[0]);
                }
            }
            else{
                tracker.remove();

                for(var i = 0; i < this.trackers.length; i++){
                  if(this.trackers[i] == tracker){
                    this.trackers.splice(i, 1)
                  }
                }
            }
        },

        updateTracker: function(tracker){
            if(!tracker){
                for(var i = 0; i < this.trackers.length; i++){
                  this.updateTracker(this.trackers[i])
                }
            }
            else{

                var shape, box;

                // Need to hack for GroupSet (importSVG)
                shape = (tracker.shape.group) ? tracker.shape.group : tracker.shape;
                box = shape.getBBox();

                //this is somewhat hackish, if someone finds a better way to do it...
                if(shape.type == "path" && this.action.substr(0,4) == "path"){
                  var pathsplit = Raphael.parsePathString(shape.attr("path"))
                  if(pathsplit.length == 2){
                    tracker[0].attr({cx: box.x + box.width/2, cy: box.y + box.height/2})
                    tracker[1].attr({x: pathsplit[0][1]-2, y: pathsplit[0][2]-2})
                    tracker[2].attr({x: pathsplit[1][1]-2, y: pathsplit[1][2]-2})
                  }
                  return;
                }

                //i wish my code could be as dated as possible by referencing pieces of culture
                //though I *hope* nobody needs to use svg/vml whatever in the near future
                //there coudl be a lot of better things
                //and svg-edit is a better project
                //so if the future even uses raphael, then microsoft really sucks
                //it truly is "more evil than satan himself" which is itself dated even for the time of writing
                //and am I ever gonna read this? If it's someone that's not me that's reading this
                //please tell me (if year > 2010 or otherwise)
                tracker.translate(box.x - tracker.lastx, box.y - tracker.lasty)

                //now here for the magic
                if(shape._ && shape._.rt){
                  tracker.rotate(shape._.rt.deg, (box.x + box.width/2), (box.y + box.height/2))
                }

                tracker.lastx = box.x//y = boxxy trollin!
                tracker.lasty = box.y
            }
        },

        trackerBox: function(x, y, action){
            var w = 4
            var shape = this.draw.rect(x - w, y - w, 2*w, 2*w).attr({
            "stroke-width": 1,
            "stroke": "green",
            "fill": "white"
            //THE FOLLOWING LINES HAVE BEEN COMMENTED DUE TO A HORRIBLE BUG IN RAPHAEL
            }).mouseover(function(){
            this.attr("fill", this.paper.editor.prop.fill);
            try{ //easy way out! try catch!

              /*
              if(this.paper.editor.trackers[0][0].attr("rotation").split(" ")[0] == "0" && this.paper.editor.action != "resize"){ //ugh
                this.paper.editor.tooltip("Click and drag to resize shape",
               {x: this.attr("x")+10, y: this.attr("y")+5});
              }else if(this.paper && this.paper.editor && this.paper.editor.hideTooltip){
                this.paper.editor.hideTooltip()
              }*/
            }catch(err){}

            }).mouseout(function(){
            this.attr("fill", "white")
            if(this.paper && this.paper.editor && this.paper.editor.hideTooltip)
              this.paper.editor.hideTooltip();

            }).mousedown(function(event){
            //console.log(event)
            if(this.paper && this.paper.editor)
              this.paper.editor.action = action;

            });
            var othis = this;
            if(this.mobilesafari){
            shape.node.addEventListener("touchstart", function(e){
                    othis.action = action;
                    e.preventDefault();
                    return false
            }, false)
            shape.node.addEventListener("touchmove", function(e){
                    e.preventDefault();
                    return false;
            }, false)
            shape.node.addEventListener("touchend", function(e){
                e.preventDefault()
            }, false)
            }
            shape.node.is_tracker = true;
            return shape;
        },

        trackerCircle: function(x, y){
            var w = 5
            var shape = this.draw.ellipse(x, y, w, w).attr({
                "stroke-width": 1,
                "stroke": "green",
                "fill": "white"
            }).mouseover(function(){
                this.attr("fill", "red")
                try{

                  /*
                  //easy way out! try catch!
                  if(this.paper.editor.trackers[0][0].attr("rotation").split(" ")[0] == "0"){ //ewwie!
                  this.paper.editor.tooltip("Drag to rotate shape or double click to reset.",
                   {x: this.attr("cx")+5, y: this.attr("cy")});
                  } */
                }catch(err){}
            }).mouseout(function(){
                this.attr("fill", "white")
                this.paper.editor.hideTooltip()
            }).mousedown(function(){
                this.paper.editor.action = "rotate";
            }).dblclick(function(){
                this.paper.editor.trackers[0].shape.rotate(0, true); //absolute!
                this.paper.editor.updateTracker();
            });
            shape.node.is_tracker = true;
            return shape;
        },

        hideTooltip: function(){
            this.tt.hide();
        },

        tooltip: function(t,bbox){
            if(!this.tt){
                var set = this.draw.set();
                set.push(this.draw.text(0,0,"x"))
                set.push(this.draw.rect(0,0,1,1))
                this.tt = set;
            }
            var set = this.tt;

            set.show();
            set.toFront();
            var text = set[0];
            var rect = set[1];
            text.attr("text", t);
            text.attr("x", bbox.x);
            text.attr("y", bbox.y);
            var txb = text.getBBox() //i wish i knew a better way to align it like that
            text.attr("x", bbox.x + txb.width/2 + 8)
            txb = text.getBBox()

            rect.attr({
              x: txb.x-5,
              y: txb.y,
              width: txb.width+10,
              height: txb.height,
              r: 3
            })
            rect.attr("fill","#7cb6ef") //it's the first 6 letters of the hex SHA1 hash of "false"
            .insertBefore(text);

            return set;
        },

        markTracker: function(shape){
            shape.node.is_tracker = true;
            return shape;
        },

        newTracker: function(shape){
          for(var i = 0; i < this.trackers.length; i++){
            if (this.isLayer(this.trackers[i].shape)) {
                var groupSet = this.getGroupSet(this.trackers[i].shape);
                if (groupSet == shape) {
                    this.removeTracker(this.trackers[i]);
                }
            }
            else {
               if(this.trackers[i].shape == shape){
                   this.removeTracker(this.trackers[i]);
               }
            }
          }

          if (typeof(shape.groupSet) != "undefined") {
            this.showTracker(shape.proxy);
          }
          else {
            this.showTracker(shape);
          }

        },

        showTracker: function(shape){
            var rot_offset = -14;
            var box = shape.getBBox(),
                trackerBox = null,
                tracker = this.draw.set();
            tracker.shape = shape;

            //define the origin to transform to
            tracker.lastx = 0 //if zero then easier
            tracker.lasty = 0 //if zero then easier

            // Central tracker circle
            tracker.push(this.markTracker(this.draw.ellipse(box.width/2, box.height/2, 7, 7).attr({
                "stroke": "gray",
                "stroke-opacity": 0.5,
                "fill": "gray",
                "fill-opacity": 0.15
              })).mousedown(function(){
                this.paper.editor.action = "move"
              }));

            //draw everything relative to origin (0,0) because it gets transformed later
            if(shape.subtype == "line") {
                var line = Raphael.parsePathString(shape.attr('path'));

                tracker.push(this.trackerBox(line[0][1]-box.x,line[0][2]-box.y,"path0"))
                tracker.push(this.trackerBox(line[1][1]-box.x,line[1][2]-box.y,"path1"))
                this.trackers.push(tracker)
            }
            else if(shape.type == "rect" || shape.type == "image" || shape.type == "group") {
                tracker.push(this.draw.rect(-6, -6, box.width + 11, box.height + 11).attr({"opacity":0.3}))

                tracker.push(this.trackerCircle(box.width/2, rot_offset))
                tracker.push(trackerBox = this.trackerBox(box.width+5,box.height+5,"resize"));
                trackerBox.node.shape_object = shape;
                this.trackers.push(tracker);
            }
            else if(shape.type == "ellipse") {

                tracker.push(this.trackerCircle(box.width/2, rot_offset))
                tracker.push(this.trackerBox(box.width+5,box.height+5,"resize"))
                this.trackers.push(tracker)
            }
            else if(shape.type == "text") {
                tracker.push(this.draw.rect(-6, -6, box.width + 11, box.height + 11).attr({"opacity":0.3}))
                tracker.push(this.trackerCircle(box.width/2, rot_offset))
                tracker.push(this.trackerBox(box.width+5,box.height+5,"resize"))
                this.trackers.push(tracker)
            }
            else if(shape.type == "path" && shape.subtype != "line") {
                tracker.push(this.draw.rect(-6, -6, box.width + 11, box.height + 11).attr({"opacity":0.3}))
                tracker.push(this.trackerBox(box.width+5,box.height+5,"resize"))
                tracker.push(this.trackerCircle(box.width/2, rot_offset))
                this.trackers.push(tracker)
            }
            else {
                tracker.push(this.draw.rect(-6, -6, box.width + 11, box.height + 11).attr({"opacity":0.3}))
                tracker.push(this.trackerCircle(box.width/2, rot_offset))
                this.trackers.push(tracker)
            }
            this.updateTracker(tracker)
        },

        showGroupTracker: function(shape){
            var tracker = this.draw.set();
            var box = shape.getBBox();

            tracker.push(this.markTracker(this.draw.ellipse(box.width/2, box.height/2, 7, 7).attr({
              "stroke": "gray",
              "stroke-opacity": 0.5,
              "fill": "gray",
              "fill-opacity": 0.15
            })).mousedown(function(){
              this.paper.editor.action = "move"
            }));

            tracker.push(this.draw.rect(-6, -6, box.width + 11, box.height + 11).attr({
            "stroke-dasharray": "-",
            "stroke": "blue"
            }))
            tracker.shape = shape;
            //define the origin to transform to
            tracker.lastx = 0 //if zero then easier
            tracker.lasty = 0 //if zero then easier
            this.trackers.push(tracker)

            this.updateTracker(tracker)
        }

    }

})(jQuery);

// Mixin with ShapeContainerMixin
App.Utils.augment(App.Editor, ShapeContainerMixin);