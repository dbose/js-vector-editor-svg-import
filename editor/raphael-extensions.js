// rapheal shapes
// Src: https://github.com/wout/raphael-svg-import/blob/master/lib/raphael-shapes.js

// extending raphael with a polygon function (to be used with raw SVG polygon data)
Raphael.fn.polygon = function(cx, cy, points) {
    return this.path()
        .sett({ type: "polygon", points: points })
        .translate(cx, cy);
};

// adding a n-gon element
Raphael.fn.ngon = function(cx, cy, r, points) {
    return this.path()
        .sett({ type: "ngon", r: r, points: points })
        .translate(cx, cy);
}

// adding a star element
Raphael.fn.star = function(cx, cy, r1, r2, points) {
    return this.path()
        .sett({ type: "star", r1: r1, r2: r2, points: points })
        .translate(cx, cy);
}

// adding a star element
Raphael.el.sett = function() {
    var setts = {};
    if (typeof arguments[0] == "string") {
        setts[arguments[0]] = arguments[1];
    } else if (arguments[0]) {
        setts = arguments[0];
    }
    this.setts = $H(this.setts).merge(setts).toObject();
    return this.attr("path", this[this.setts.type]());
}

// n-gon path function
Raphael.el.ngon = function() {
    var points = [],
        n = this.setts.points,
        r = this.setts.r,
        part = 360 / n;
    (n).times(function(i) {
        var a = i * part - 90,
            x = r * Math.cos(a * Math.PI / 180),
            y = r * Math.sin(a * Math.PI / 180);
        points.push((i == 0 ? "M" : "L") + x + "," + y);
    });
    points.push("Z");
    return points.join(" ");
}

// star path function
Raphael.el.star = function() {
    var points = [],
        n = this.setts.points,
        r1 = this.setts.r1,
        r2 = this.setts.r2,
        part = 360 / n;
    (n).times(function(i) {
        var a = i * part + 90,
            x = r1 * Math.cos(a * Math.PI / 180),
            y = r1 * Math.sin(a * Math.PI / 180);
        points.push((i == 0 ? "M" : "L") + x + "," + y);
        a += part / 2;
        x = r2 * Math.cos(a * Math.PI / 180),
            y = r2 * Math.sin(a * Math.PI / 180),
            points.push("L" + x + "," + y);
    });
    points.push("Z");
    return points.join(" ");
}

// polygon function
Raphael.el.polygon = function() {
    var poly_array = ["M"];
    $w(this.setts.points).each(function(point, i) {
        point.split(",").each(function(c) {
            poly_array.push(parseFloat(c));
        });
        if (i == 0) poly_array.push("L");
    });
    poly_array.push("Z");
    return poly_array.compact();
}

Raphael.fn.line = function(attr){
    var pathString = ["M",
        attr.x1,
        attr.y1,
        "L",
        attr.x2,
        attr.y2,
        "Z"];
    delete attr.x1;
    delete attr.y1;
    delete attr.x2;
    delete attr.y2;
    return this.path(pathString);
};

Raphael.fn.polyline = function(pointString) {
    //var pointString = attr.points;
    var poly = ['M'],
        point = pointString.trim().split(' ');

    for(var i=0; i < point.length; i++) {
        var c = point[i].split(',');
        for(var j=0; j < c.length; j++) {
            var d = parseFloat(c[j]);
            if (!isNaN(d))
                poly.push(d);
        }
        if (i === 0)
            poly.push('L');
    }
    return this.path(poly.join(' '));
};

Raphael.el.setGroup = function (group) {
    this.group = group;
};
Raphael.el.getGroup = function () {
    return this.group;
};


Raphael.el.scaleToContainer = function(x, y, cx, cy, box) {
    if (this.type !== 'text') {
        return;
    }

    var bb = this.getBBox(),
        kx = x / this._.sx,
        ky = y / this._.sy,
        nx,
        ny;

    // Calculate alignment offset
    var align_offset_x = this.attr("x") - bb.x,
        align_offset_y = this.attr("y") - bb.y

    // Calculate offset of this text shape w.r.t to the bounding box/container
    var offset_x = bb.x - box.x,
        offset_y = bb.y - box.y;

    // Calculate scaling effects on offsets
    nx = box.x + offset_x * kx;
    ny = box.y + offset_y * ky;

    this.attr({
        x: nx + align_offset_x,
        y: ny + align_offset_y
    });

    this._.sx = x;
    this._.sy = y;

    return this;
}

Raphael.fn.transformMatrix = function(matrixString) {

    var matrix = matrixString.substring(7, matrixString.length-1).split(/[,\s]{1}/)
        .map(function(x){
            return parseFloat(x);
        });

    // Based on conventions described here	- http://www.w3.org/TR/SVG/coords.html#SkewXDefined
    var a = matrix[0], b = matrix[1], c = matrix[2], d = matrix[3], e = matrix[4], f = matrix[5];

    // NOTE:
    //		In illustrator files b=c=0, and this gives us opportunity to re-use existing APIs

    // Here we'll de-construct these transformation to more conventional term and pass it through Raphael
    // API (again, to make it platform neutral)
    var norm = function (a) {
        return a[0] * a[0] + a[1] * a[1];
    };
    var normalize = function (a) {
        var mag = Math.sqrt(norm(a));
        a[0] && (a[0] /= mag);
        a[1] && (a[1] /= mag);
    };
    var deg = function (rad) {
        return rad * 180 / Math.PI % 360;
    };

    // Calculate translation factors
    var dx = e, dy = f;

    // Calculate scaling factors
    var row = [[a, c], [b, d]];
    var scalex = Math.sqrt(norm(row[0]));
    normalize(row[0]);
    var shear = row[0][0] * row[1][0] + row[0][1] * row[1][1];
    row[1] = [row[1][0] - row[0][0] * shear, row[1][1] - row[0][1] * shear];
    var scaley = Math.sqrt(norm(row[1]));
    normalize(row[1]);

    // Calculate rotation factors
    var rotate;
    var sin = -row[0][1],
        cos = row[1][1];
    if (cos < 0) {
        rotate = deg(Math.acos(cos));
        if (sin < 0) {
            rotate = 360 - rotate;
        }
    } else {
        rotate = deg(Math.asin(sin));
    }

    return {
        tx: dx,
        ty: dy,
        sx: scalex,
        sy: scaley,
        deg: rotate
    };
};

/*
 Draw an underline for a text-shape
 */
Raphael.el.underline = function(show, params) {
    if (this.type == 'text') {
        if (show) {

            // Retrieve bounding box
            var bbox = this.getBBox();

            // Remove any existing underline
            if (this.uline == null) {

                // Draw a new "underline" path
                this.uline = this.paper.path('M' + bbox.x + ' ' + (bbox.y + bbox.height) + 'L' + (bbox.x + bbox.width) + ' ' + (bbox.y + bbox.height));

                // Generate a new ID for this
                var id = this.paper.raphael.createUUID();
                this.uline.id = this.uline.node.id = id

                // Color the underline
                this.uline.attr({
                    "stroke": 	params["stroke"],
                    "fill": 	params["fill"]
                });
            }

        } else {
            if (this.uline != null) {
                this.uline.remove();
                this.uline = null;
            }
        }
    }

    return this;
};

/*
 Wraps text given a width
 */
Raphael.el.wrap = function(width) {
    if (this.type == "text") {
        var content = this.attr("text");

        // Try to measure letter width.
        var abc="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        this.attr({'text-anchor': 'start', "text": abc});
        var letterWidth = this.getBBox().width / abc.length;


        this.attr({"text": content});
        var words = content.split(" "), x=0, s=[];
        for ( var i = 0; i < words.length; i++) {

            // Get letters in the word
            var l = words[i].length;

            // Accumulate letter width so far
            x += l*letterWidth;

            // If greater than given width, wrap (push a newline)
            if(x > width) {
                s.push("\n");
                x=0;
            }

            s.push(words[i]+" ");
        }

        // Set the text wrapped
        this.attr({"text": s.join("")});
    }

    return this;
};

Raphael.fn.createUnderLine = function(x, y, params) {

    var _text = this.text(x, y, params['text'])
        .attr('font-size',params['font-size'])
        .attr({"stroke": "#3333FF","fill": "#3333FF"});
    _text.underline(true, {
        "stroke": "#3333FF",
        "fill": "#FFFFFF"
    });
    //shape.subtype = "link";

    var shape = this.set();
    shape.push(_text);
    shape.push(_text.uline);

    var tBBox = _text.getBBox();
    var bbox = {
        x:      tBBox.x - 10,
        y:      tBBox.y - 10,
        width:  tBBox.width + 10,
        height: tBBox.height + 10
    };

    var templatedTextSet = [[_text]];
    // Draw the "layer" (invisible rect)
    var newlayer = this.rect(bbox.x, bbox.y, bbox.width, bbox.height).attr({
        fill: "#FFF",
        "fill-opacity": 0,
        "stroke-opacity": 0,
        opacity: 0,
        cursor: "move",
        layer: true
    });

    var superGroup = this.set();
    superGroup.groupSet = true;
    superGroup.proxy = newlayer;
    superGroup.shape = shape;
    superGroup.wi = bbox.width;
    superGroup.hi = bbox.height;
    superGroup["composite-type"] = "link";
    superGroup.id = this.raphael.createUUID();

    // Push the text set
    superGroup.textShapes = this.set();
    superGroup.nonTextSet = this.set();

    // Push the "templated" text in a different collection
    superGroup.templatedTextSet = templatedTextSet;

    superGroup.all_shapes = shape;

    superGroup.push(shape);
    superGroup.push(newlayer);
    newlayer.setGroup(superGroup);

    newlayer.toFront();
    return newlayer;

}



/*
 This will be called for a number of shapes (composite/set) after their textual content is persisted

 draw:  	true, if being drawn first-time
 false, if being updated

 NOTE:
 this["composite-type"] will be used to differentiate between various composite shapes and take
 relevant actions
 */
Raphael.st.afterTextSerialization = function(draw, params) {

    //Verify whether this shape is a compsite-shape defined by us
    if (typeof(this["composite-type"]) == "undefined") {
        // A normal Raphael set. Ignore.
        return this;
    }

    var type = this["composite-type"],
        superGroup = this;
    switch(type) {
        case "link":
            // Implicit assumption that link will have one text element
            var link = superGroup.templatedTextSet[0][0];

            if (draw) {
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
    }

    // Upate the dimension of the "transparent proxy"
    this.updateGroupLayer(this.getBBox());

    return this;
};

/*
 Updates the superGroup and layer after a re-draw
 */
Raphael.st.updateGroupLayer = function(bbox) {

    //Verify whether this shape is a compsite-shape defined by us
    if (typeof(this["composite-type"]) == "undefined") {
        // A normal Raphael set. Ignore.
        return this;
    }

    var type = this["composite-type"],
        superGroup = this,
        layer = superGroup.proxy;

    // Resize the layer
    layer.attr({
        x: 		bbox.x,
        y: 		bbox.y,
        width:  bbox.width,
        height: bbox.height
    });

    return this;
}

/*
 Context:
 The toBack() function when gets applied to the "composite shape" (superGroup), it simply gets applied to
 all the containing elements/sets recursively. First comes the "background-most" (B0 or B3) shape/element.
 It gets pushed to last by toBack(). Then the shape/element after the B0/B3, gets pushed "behind"
 B0/B3, and so on.

 So the initial sequence was -

 [Composite-Shape 1]     [Composite-Shape 2]     ...
 B0 -> B1 -> B2          B3 -> B4 -> B5

 After the blind application of "toBack()" on [Composite-Shape 2] , the sequence becomes

 [Composite-Shape 2]     [Composite-Shape 1]
 B5 -> B4 -> B3          B0 -> B1 -> B2

 Now this is not what is intended. If B3 is some opaque shape, [Composite-Shape 2] will be invisible.

 To circumvent that we introduce fixToBack() function on "group sets" or "composite-shapes"

 The ideal sequence should be -

 [Composite-Shape 2]     [Composite-Shape 1]          ...
 B3 -> B4 -> B5          B0 -> B1 -> B2

 */
Raphael.st.fixToBack = function() {

    //Verify whether this shape is a composite-shape defined by us
    if (typeof(this["composite-type"]) == "undefined") {
        // A normal Raphael set. Ignore.
        return this;
    }


    var all_shapes = this.all_shapes,
        len = all_shapes.length,
        shape = null,
        last_shape = null;

    if (all_shapes.length == 0) {
        return this;
    }

    // Push the first shape (probably the background shape, unless there is a pair) to back
    var backgroundElement = all_shapes[0];

    backgroundElement.toBack();

    // And then move every element after the background element, including the "transparent proxy" / "layer"
    last_shape = backgroundElement;
    for(var i = 1; i < len; i++) {
        shape = all_shapes[i];
        shape.insertAfter(last_shape);
        last_shape = shape;
    }

    // Push the "layer" back as well.
    this.proxy.insertAfter(last_shape);
};

/*
 Takes a matrix string like - matrix(1.2988741,0,0,1.2988741,38.0288,-16.12712) and apply
 this on this element.

 This kind of matrix support is probably in Raphael 2.0, but changes are not compatible with our modified
 js-vector-editor codebase.
 */
Raphael.el.applyTransformation = function(matrix) {

    // Handle texts specially as Illustrator mostly generates matrix like - matrix(1 0 0 1 76.7129 63.5)
    if ((this.type == 'text') || (this.type == 'image')) {
        var matrix_values = matrix.substring(7, matrix.length-1).split(/[,\s]{1}/)
            .map(function(x){
                return parseFloat(x);
            });
        var e = matrix_values[4],
            f = matrix_values[5] - 7;

        // Translate the text to [e,f]
        this.translate(e,f);
    }
    else {
        var transform_params = (typeof(matrix) == "string")
            ? Raphael.fn.transformMatrix(matrix)
            : matrix;

        if (transform_params) {
            this.translate(transform_params.tx, transform_params.ty)
                .rotate(transform_params.deg)
                .scale(transform_params.sx, transform_params.sy);
        }
    }


    return this;
}

Raphael.el.getTranslationParams = function() {
    return {
        x: this._.tx,
        y: this._.ty
    };
};


/*
 Set level applyTransformation.

 NOTE:
 For details, see Raphael.el.applyTransformation
 */
Raphael.st.applyTransformation = function(matrix) {

    // Calculate once
    var transform_params = (typeof(matrix) == "string")
        ? Raphael.fn.transformMatrix(matrix)
        : matrix;

    // Translation
    for(var i = 0; i < this.items.length; ++i) {
        this.items[i].applyTransformation(transform_params);
    }

    return this;
};


Raphael.fn.cloneSet = function(oldSet) {

    var newSet = this.set();

    for (var i = 0, ii = oldSet.items.length; i < ii; i++) {
        var oldItem = oldSet.items[i];

        if (typeof(oldItem.items) != 'undefined') {

        }
        else {
            var newItem = oldItem.clone();

            // FIX:
            //      Copy magic structures like "_"
            newItem._.sx = oldItem._.sx;
            newItem._.sy = oldItem._.sy;
            newItem._.tx = oldItem._.tx;
            newItem._.ty = oldItem._.ty;

            newSet.push(newItem);
        }

    }

    // Assign new IDs (identifiers shouldn't be copied), but copy the groupId
    if (oldSet.hasOwnProperty("groupId")) {
        newSet["groupId"] = oldSet["groupId"];
    }

    newSet["id"] = this.raphael.createUUID();

    return newSet;
};

Raphael.fn.copy = function(group) {
    var all_shapes = this.set();
    var textSet = this.set();
    var nonTextSet = this.set();
    var templatedTextSet = [];
    var groupSet = {};
    var elementalGroup = null;
    var font = this.getFont("Comic Sans MS");
    var defaultTextAttr = {
        // stroke: "none"
        "text-anchor": "start"  // raphael defaults to "middle"
    };

    // Used to track down the top most group from the group hash
    var firstGroupKey = null;

    var id = 0, strID, composite_type;
    this.parseElement = function(shape) {
        // TODO:
        //		Merge default styles (attr passe) from editor with individual ones
        var attr = {}, i, text_line_number = null;
        strID = this.raphael.createUUID();

        if (typeof(shape.items) != 'undefined') {

            // Nested set
            var groupId = strID;

            if (firstGroupKey == null) {
                firstGroupKey = groupId;
            }

            var thisGroup = this.set();
            thisGroup.id = groupId;

            for (i = 0; i < shape.items.length; ++i) {
                childShape = this.parseElement(shape.items[i]);
                childShape["groupId"] = groupId;
                childShape["parentGroup"] = thisGroup;
                thisGroup.push(childShape);
            }

            if (!elementalGroup && (typeof(shape.elemental) != 'undefined')) {
                thisGroup.elemental = true;
                elementalGroup = thisGroup;
            }

            // hold onto thisGroup just in case
            if (groupId && shape.items.length) {
                groupSet[groupId] = thisGroup;
            }
            return thisGroup;
        }
        else {

            // Element
            var newShape = shape.clone();

            if (shape.hasOwnProperty("templated")) {
                text_line_number = shape["templated"];
            }
            if (shape.type == "text") {
                textSet.push(newShape);

                // Look for template-text
                if (text_line_number != null) {

                    // Create a 2D array, where index in dimension-1 denoting the line numbers
                    if (typeof(templatedTextSet[text_line_number]) == "undefined") {
                        templatedTextSet[text_line_number] = [];
                    }
                    templatedTextSet[text_line_number].push(newShape);
                    newShape["templated"] = text_line_number;
                }
            }
            else {
                nonTextSet.push(newShape);
            }

            // Assign an ID (neede for DOM)
            newShape.node.id = strID;
            newShape.id = strID;

            all_shapes.push(newShape);

            return newShape;
        }

    };

    try {
        composite_type = group["composite-type"];
        this.parseElement(group.shape);
    }
    catch (error) {
        throw "COPY (" + error + ")";
    }

    // Now we need to perform trick. By default "sets" are non-SVG element and
    // Rapheal can't draw them. So the idea is to draw a "layer" (invisible rectangle) on top of the set
    //

    shape = groupSet[firstGroupKey];

    // Get the bounding box (Ignore texts from Bounding Box calculation)
    var bbox = nonTextSet.items.length > 0 ? nonTextSet.getBBox() : textSet[0].getBBox();

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

    // Draw the "layer" (invisible rect)
    var newlayer = this.rect(bbox.x, bbox.y, bbox.width, bbox.height).attr({
        fill: "#FFF",
        "fill-opacity": 0,
        "stroke-opacity": 0,
        opacity: 0,
        cursor: "move",
        layer: true
    });

    var superGroup = this.set();
    superGroup.groupSet = true;
    superGroup.proxy = newlayer;
    superGroup.shape = shape;
    superGroup.wi = bbox.width;
    superGroup.hi = bbox.height;
    superGroup["composite-type"] = composite_type;
    superGroup.id = this.raphael.createUUID();

    // Push the text set
    superGroup.textShapes = textSet;

    superGroup.nonTextSet = nonTextSet;

    // Push the "templated" text in a different collection
    superGroup.templatedTextSet = templatedTextSet;

    superGroup.all_shapes = all_shapes;

    // Elemental group
    superGroup.elementalGroup = elementalGroup;

    superGroup.push(shape);
    superGroup.push(newlayer);
    newlayer.setGroup(superGroup);

    newlayer.toFront();
    return newlayer;
};


/*
 Adds the given group to the composite shape, updating all relevant data structures
 */
Raphael.st.addGroup = function(group, vertical) {

    if (typeof(this["composite-type"]) == "undefined") {
        return this;
    }

    var targetGroup = this,
        i,
        shape,
        textShapes = targetGroup.textShapes,
        nonTextSet = targetGroup.nonTextSet,
        templatedTextSet = targetGroup.templatedTextSet,
        all_shapes = targetGroup.all_shapes;

    for (i = 0; i < group.items.length; ++i) {
        shape = group.items[i];

        if (typeof(shape.items) != 'undefined') {
        }
        else {

            // Initialize the shape indices. These will be used to splice out the shape from various
            // sets.
            shape.indices = shape.indices || {};

            // Element
            if (shape.type == "text") {
                textShapes.push(shape);
                shape.indices["textShapes_Index"] = (textShapes.length - 1);

                // Template texts
                if (vertical) {
                    shape["templated"] = templatedTextSet.length;
                    templatedTextSet[templatedTextSet.length] = [shape];
                    shape.indices["templatedTextSet_Index"] = 0;
                }
                else {
                    templatedTextSet[0].push(shape);
                    shape["templated"] = 0;
                    shape.indices["templatedTextSet_Index"] = (templatedTextSet[0].length - 1);
                }
            }
            else {
                nonTextSet.push(shape);
                shape.indices["nonTextSet_Index"] = (nonTextSet.length - 1);
            }

            // All shapes
            all_shapes.push(shape);
            shape.indices["all_shapes_Index"] = (all_shapes.length - 1);
        }
    }

    // Push to the actual shape collection
    targetGroup.shape.push(group);

    return this;
};

/*
 Import a shape from a SVG XML (storage format, not the SVG DOM), parse it and pass it through Raphael, so that
 the whole process gains from the Browser-Compatibility strength of Raphael. This function handles SVG <group>
 and map it to Raphael set(). As set doesn't have any graphical representation in DOM, we need to return something
 "concrete" from this function. That's why we create a "transparent proxy" spanning over the entire set (using
 the getBBox function) and name it a "layer" (photoshop-like). The "layer" is basically a "rect" element,
 having full transparency and has a reference (through setGroup/getGroup) to the superGroup.
 Now what is this superGroup?

 superGroup has a composition like this -


 superGroup (A Raphael Set) --------(shape)---------> A Raphael Set (containing nested shapes)
 |
 |
 |------------------(proxy)--------> A Raphael Rect denoting a transparent
 ^									"layer" (as returned from importSVG)
 |											|
 |											|
 |-------------------(group)-----------------|

 superGroup is required to "contain" the "layer" and the set containing actual shapes, so that when superGroup
 gets "dragged" the whole assembly moves.

 Requirement: This function requires the XML passed to be enclosed in a group (<g>..</g>)
 */
Raphael.fn.importSVG = function (svgXML, attr) {
    var all_shapes = this.set();
    var textSet = this.set();
    var nonTextSet = this.set();
    var templatedTextSet = [];
    var groupSet = {};
    var elementalGroup = null;
    var font = this.getFont("Comic Sans MS");
    var defaultTextAttr = {
        // stroke: "none"
        "text-anchor": "start"  // raphael defaults to "middle"
    };
    var text_font = "Comic Sans MS";

    var forcedAttributes = {
        "font-family": attr["font-family"],
        "stroke-width": attr["stroke-width"]
    }

    // Used to track down the top most group from the group hash
    var firstGroupKey = null;


    this.stringtoXML = function(text) {
        var doc;
        if (window.ActiveXObject){
            doc = new ActiveXObject('Microsoft.XMLDOM');
            doc.async = 'false';
            doc.loadXML(text);
        }
        else {
            var parser = new DOMParser();
            doc = parser.parseFromString(text,'text/xml');
        }
        return doc.documentElement;
    };

    // Create XML DMO Document, if string is passed
    if (typeof(svgXML) != "object") {
        svgXML = this.stringtoXML(svgXML);
    }

    try {
        var id = 0, strID;
        this.parseElement = function(elShape, attrs) {

            // skip text nodes
            if (elShape.nodeType == 3) {
                return;
            }

            tag_supported = elShape.nodeName.toLowerCase();
            if (!((tag_supported == "svg") ||
                (tag_supported == "g") ||
                (tag_supported == "switch") ||
                (tag_supported == "rect") ||
                (tag_supported == "circle") ||
                (tag_supported == "ellipse") ||
                (tag_supported == "path") ||
                (tag_supported == "polygon") ||
                (tag_supported == "polyline") ||
                (tag_supported == "line") ||
                (tag_supported == "image") ||
                (tag_supported == "text"))) {
                return;
            }

            // TODO:
            //		Merge default styles (attr passe) from editor with individual ones
            var attr = {
                "stroke" : attrs.hasOwnProperty("stroke") ? attrs["stroke"] : null,
                "fill" : attrs.hasOwnProperty("fill") ? attrs["fill"] : null
            }, i, text_line_number = null;

            // Increment ID
            id++;
            strID = this.raphael.createUUID();

            if (elShape.attributes){
                var attr_name;
                for (i = elShape.attributes.length - 1; i >= 0; --i){
                    attr_name = elShape.attributes[i].name;
                    // NOTE:
                    //		"templated" means the content of the text element will be changed
                    //
                    // 		Hack to make sure "templated" doesn't end up causing any issues
                    if (attr_name == 'templated') {
                        text_line_number = parseInt(elShape.attributes[i].value);
                    }


                    if (attr_name == 'x' || attr_name == 'y') {
                        attr[attr_name] = parseInt(elShape.attributes[i].value || 100);
                    }
                    else{
                        attr[attr_name] = elShape.attributes[i].value;
                    }

                    // Take account of any "id" if peresent in XML
                    if (attr.hasOwnProperty('id')) {
                        strID = attr["id"]
                    }
                }
            }

            var shape, style;
            var shapeName = elShape.nodeName;
            switch(shapeName) {
                case "svg":
                case "g":
                case "switch":
                    // pass the id to the first child, parse the children
                    //var groupId = elShape.getAttribute('id');
                    var groupId = strID;

                    if (firstGroupKey == null) {
                        firstGroupKey = groupId;
                    }

                    var thisGroup = this.set();
                    thisGroup.id = groupId;
                    var childShape;
                    for (i = 0; i < elShape.childNodes.length; ++i) {
                        childShape = this.parseElement(elShape.childNodes.item(i), attrs);

                        // For "text" nodes childShape can be "undefined"
                        if (typeof(childShape) != "undefined") {
                            childShape["groupId"] = groupId;
                            childShape["parentGroup"] = thisGroup;
                            thisGroup.push(childShape);
                        }
                    }

                    // handle display=none
                    if (attr.display === "none") {
                        thisGroup.hide();
                    }

                    // Handle elemental group.
                    if (!elementalGroup && attr.hasOwnProperty("elemental")) {
                        thisGroup.elemental = true;
                        elementalGroup = thisGroup;
                    }

                    if (attr.hasOwnProperty("transform")) {
                        thisGroup.applyTransformation(attr["transform"]);
                        delete attr["transform"];
                    }

                    // hold onto thisGroup just in case
                    if (groupId && elShape.childNodes.length) {
                        groupSet[groupId] = thisGroup;
                    }
                    return thisGroup;
                case "rect":
                    if (attr.rx && attr.ry) {
                        attr.r = (+(attr.rx || 0) + (+(attr.ry || 0))) / 2;
                        delete attr.rx;
                        delete attr.ry;
                    } else {
                        attr.r = attr.rx || attr.ry || 0;
                        delete attr.rx;
                        delete attr.ry;
                    }
                /* falls through */
                case "circle":
                case "ellipse":
                    shape = this[shapeName]();
                    break;
                case "path":
                    shape = this.path(attr.d);
                    delete attr.d;
                    break;
                case "polygon":
                    shape = this.polygon(attr.points);
                    break;
                case "polyline":
                    shape = this.polyline(attr.points);
                    break;
                case "line":
                    shape = this.line(attr);
                    break;
                case "image":
                    if (attr.href) {
                        shape = this.image(attr.href, 10, 10, attr.width || 100, attr.height || 100);
                    }
                    else {
                        shape = this.image();
                    }

                    break;
                case "text":
                    for (var key in defaultTextAttr){
                        if (!attr[key] && defaultTextAttr.hasOwnProperty(key)) {
                            attr[key] = defaultTextAttr[key];
                        }
                    }

                    // Override text fonts to Comic Sans MS for a sketchy look
                    attr["font-family"] = text_font;

                    shape = this.text(attr.x, attr.y, elShape.text || elShape.textContent);
                    //shape = this.print(attr.x, attr.y, elShape.text || elShape.textContent, font, attr["font-size"] || 10)
                    textSet.push(shape);

                    // Look for template-text
                    if (text_line_number != null) {

                        // Create a 2D array, where index in dimension-1 denoting the line numbers
                        if (typeof(templatedTextSet[text_line_number]) == "undefined") {
                            templatedTextSet[text_line_number] = [];
                        }
                        templatedTextSet[text_line_number].push(shape);
                        shape["templated"] = text_line_number;
                    }
                    break;
                default:
                    var elSVG = elShape.getElementsByTagName("svg");
                    if (elSVG.length){
                        elSVG[0].normalize();
                        this.parseElement(elSVG[0]);
                    }
                    return;
            }


            // Error : "non_object_property_load"
            if (shapeName != "image") {
                shape.attr(attr);
            }


            if (attr.hasOwnProperty("transform")) {
                shape.applyTransformation(attr["transform"]);
                delete attr["transform"];
            }

            // Assign an ID (neede for DOM)
            shape.node.id = strID;
            shape.id = strID;

            all_shapes.push(shape);

            if (shapeName != "text") {
                nonTextSet.push(shape);
            }
            return shape;
        };

        this.parseElement(svgXML, attr);
    } catch (error) {
        throw "SVGParseError (" + error + ")";
    }

    var groupsExist = false, x;
    for (x in groupSet){
        groupsExist = true;
        break;
    }

    if (groupsExist) {
        //myNewSet.groups = groupSet;


        // Now we need to perform trick. By default "sets" are non-SVG element and
        // Rapheal can't draw them. So the idea is to draw a "layer" (invisible rectangle) on top of the set
        //

        shape = groupSet[firstGroupKey];

        // Get the bounding box (Ignore texts from Bounding Box calculation)
        var bbox = nonTextSet.items.length > 0 ? nonTextSet.getBBox() : textSet[0].getBBox();

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

        // Draw the "layer" (invisible rect)
        var layer = this.rect(bbox.x, bbox.y, bbox.width, bbox.height).attr({
            fill: "#FFF",
            "fill-opacity": 0,
            "stroke-opacity": 0,
            opacity: 0,
            cursor: "move",
            layer: true
        });

        var superGroup = this.set();
        superGroup.groupSet = true;
        superGroup.proxy = layer;
        superGroup.shape = shape;
        superGroup.wi = bbox.width;
        superGroup.hi = bbox.height;
        superGroup.id = this.raphael.createUUID();

        // Push the text set
        superGroup.textShapes = textSet;

        superGroup.nonTextSet = nonTextSet;

        // Push the "templated" text in a different collection
        superGroup.templatedTextSet = templatedTextSet;

        // A flattened shapes collection
        superGroup.all_shapes = all_shapes;

        // Elemental group
        superGroup.elementalGroup = elementalGroup;

        superGroup.push(shape);
        superGroup.push(layer);
        layer.setGroup(superGroup);
        return layer;
    }

    return all_shapes;
};

Raphael.fn.fitToScale = function(factor, min_bounds) {
    var __paper = this,
        __set = __paper.set(),
        bbox = __paper.getBBox();
    min_bounds = min_bounds || [bbox.width, bbox.height];

    //var tfm = 'S0.35,0.35,0,0';
    __paper.forEach(function(obj){
        if (obj.type == 'text') {

            // Reduce font-size and X, Y

            // Reduce font
            obj.attr("font-size", parseInt(obj.attr("font-size") * factor)+1);

            // Reduce X, Y
            obj.attr("x", obj.attr("x") * factor);
            obj.attr("y", obj.attr("y") * factor);
        }
        else {
            obj.scale(factor, factor, 0, 0);
        }
        __set.push(obj);
    });


    var __size = [Math.max(__set.getBBox().width, min_bounds[0]) + 30,
        Math.max(__set.getBBox().height, min_bounds[1]) + 30];

    // But scale changes each path/shape. We need to get a bounding box
    __paper.setSize(__size[0], __size[1]);

    return __size;
}

Raphael.fn.getBBox = function() {
    var __paper = this;
    var __set = __paper.set();

    __paper.forEach(function(obj){
        __set.push(obj);
    });

    return __set;
};

// extending raphael with a polygon function
Raphael.fn.polygon = function(pointString) {
    var poly  = ['M'],
        point = pointString.split(' ');

    for(var i=0; i < point.length; i++) {
        var c = point[i].split(',');
        for(var j=0; j < c.length; j++) {
            var d = parseFloat(c[j]);
            if (d)
                poly.push(d);
        };
        if (i == 0)
            poly.push('L');
    }
    poly.push('Z');

    return this.path(poly);
};

/*
 * raphael.backward-forward 0.0.3
 *
 * Copyright (c) 2010 Wout Fierens
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

// get all elements in the paper
Raphael.fn.elements = function() {
    var b = this.bottom,
        r = [];
    while (b) {
        r.push(b);
        b = b.next;
    }
    return r;
};

// move an element in the stack
Raphael.fn.arrange = function(shape, steps, scope) {
    if (!parseInt(steps)) return;
    var elements  = scope || this.elements(),
        pos       = elements.indexOf(shape),
        lastPos  = elements.length - 1,
        newPos   = pos + steps;
    if (newPos > lastPos)
        newPos = lastPos;
    if (newPos <= 0)
        newPos = 0;
    if (steps > 0)
        shape.insertAfter(elements[newPos]);
    else if (steps < 0)
        shape.insertBefore(elements[newPos]);
    if (scope) {
        scope.splice(pos, 1);
        scope.splice(newPos, 0, shape);
    }
};

// move an element one step backward in the stack
Raphael.el.backward = function(steps, scope) {
    steps = parseInt(steps) || 1;
    this.paper.arrange(this, -steps, scope);
    return this;
};

// move an element one step forward in the stack
Raphael.el.forward = function(steps, scope) {
    steps = parseInt(steps) || 1;
    this.paper.arrange(this, steps, scope);
    return this;
};

Raphael.st.backward = function(steps, scope) {
    for(var i = 0; i < this.items.length; ++i) {
        this.items[i].backward(steps, scope);
    }
    return this;
}

Raphael.st.forward = function(steps, scope) {
    for(var i = 0; i < this.items.length; ++i) {
        this.items[i].forward(steps, scope);
    }
    return this;
}


Raphael.fn.group = function() {

    var r = this,
        cfg = (arguments[0] instanceof Array) ? {} : arguments[0],
        items = (arguments[0] instanceof Array) ? arguments[0] : arguments[1];

    function Group(cfg, items) {
        var inst,
            set = r.set(items),
            group = r.raphael.vml ?
                document.createElement("group") :
                document.createElementNS("http://www.w3.org/2000/svg", "g");

        r.canvas.appendChild(group);

        function updateScale(transform, scale) {
            var scaleString = 'scale(' + scale + ')';
            if (!transform) {
                return scaleString;
            }
            if (transform.indexOf('scale(') < 0) {
                return transform + ' ' + scaleString;
            }
            return transform.replace(/scale\(-?[0-9]+(\.[0-9][0-9]*)?\)/, scaleString);
        }

        function updateRotation(transform, rotation) {
            var rotateString = 'rotate(' + rotation + ')';
            if (!transform) {
                return rotateString;
            }
            if (transform.indexOf('rotate(') < 0) {
                return transform + ' ' + rotateString;
            }
            return transform.replace(/rotate\(-?[0-9]+(\.[0-9][0-9]*)?\)/, rotateString);
        }

        inst = {
            scale: function (newScale) {
                var transform = group.getAttribute('transform');
                group.setAttribute('transform', updateScale(transform, newScale));
                return this;
            },
            translate: function(x, y) {
                // HACK !!!
                for (var i=0; i < set.items.length; i++) {
                    var shape = set.items[i];
                    shape.translate(x,y);
                }
            },
            hide: function() {
                // HACK !!!
                for (var i=0; i < set.items.length; i++) {
                    var shape = set.items[i];
                    shape.hide();
                }
            },
            remove: function() {

                // HACK !!!
                for (var i=0; i < set.items.length; i++) {
                    var shape = set.items[i];
                    shape.remove();
                }

                r.canvas.removeChild(group);
            },
            rotate: function(deg) {
                var transform = group.getAttribute('transform');
                group.setAttribute('transform', updateRotation(transform, deg));
            },
            push: function(item) {
                function pushOneRaphaelVector(it){
                    var i;
                    if (it.type === 'set') {
                        for (i=0; i< it.length; i++) {
                            pushOneRaphaelVector(it[i]);
                        }
                    } else {
                        group.appendChild(it.node);
                        set.push(it);
                    }
                }
                pushOneRaphaelVector(item)
                return this;
            },
            getBBox: function() {
                return set.getBBox();
            },
            type: 'group',
            node: group
        };

        var bbox = set.getBBox();
        var fake_rect = r.rect(bbox.x, bbox.y, bbox.width, bbox.height);
        set.push(fake_rect);
        fake_rect.setGroup(set);
        fake_rect.attr({
            fill: "#FFF",
            "fill-opacity": 0,
            "stroke-opacity": 0,
            cursor: "move",
            type: "group"
        });
        return fake_rect;
    }

    return Group(cfg, items);

};
