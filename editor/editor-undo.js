/*
    Editor undo functionality goes here
*/
(function(jQuery, Raphael) {

    App.UndoManager = function(editor) {
        var self = this;

        // store editor
        self.editor = editor;

        // Initialize undo history
        self.undoHistory = [];

        // Handles undoing delete later
        self.deleteShape = function(shape) {

            var undoHistory = self.undoHistory;

            // Strategy is: Make a cloned shape and hide it
            var composite_type = (typeof(shape.groupSet) != 'undefined');
            var cloned_shape = (composite_type) ? self.editor.draw.copy(shape) : shape.clone();
            if (composite_type) {
              cloned_shape.group.hide();
            }
            else {
              cloned_shape.hide();
            }
            var bbox = shape.getBBox();

            // We need to figure out the corresponding "add" history node and replace that with a "delete" node
            var last_index = undoHistory.length - 1;
            var history_node = null;
            for(i = last_index; i >= 0; i--) {
                history_node = undoHistory[i];

                if (history_node.shape.getGroup() == shape) {

                    if (history_node.type == "add") {
                        undoHistory.splice(i,1,
                                {
                                    "type": "delete",
                                    "is-composite-type": composite_type,
                                    "shape-type": (composite_type) ? shape["composite-type"] : (shape.subtype ? shape.subtype : shape.type),
                                    "shape": cloned_shape,
                                    "shape-id": shape.id
                                }
                        );

                        // Push a dummy frame
                        undoHistory.push({
                            "type": "delete",
                            "shape-id": shape.id
                        });
                        break;
                    }
                    else if ((history_node.type == "scale") || (history_node.type == "move")) {
                        history_node.shape = cloned_shape;
                    }

                }
            }
        };

        self.addShape = function(shape) {
            var undoHistory = self.undoHistory;

            var last_index = undoHistory.length - 1;
            var found = false;
            var history_node = null;
            for(i = last_index; i >= 0; i--) {
                history_node = undoHistory[i];

                if ((history_node.type == "delete") && (history_node["shape-id"] == shape.id)) {
                    shape = history_node["shape"];
                    undoHistory.splice(i,1,
                        {
                            "type": "add",
                            "shape": shape
                        }
                    );
                    found = true;
                    break;
                }
            }

            if (!found) {
                undoHistory.push({
                     "type": "add",
                     "shape": shape
                });
            }

            return shape;
        };

        self.move = function(shape, x, y) {

            var superGroup = shape.getGroup();
            self.undoHistory.push({
                "type": "move",
                "shape": shape,
                "shape-id": (typeof(superGroup) != 'undefined') ? superGroup.id : shape.id,
                "params": {"x": -x, "y": -y}
            });

        };

        self.scale = function(shape, width, height) {
            var superGroup = shape.getGroup();
            self.undoHistory.push({
                "type": "scale",
                "shape": shape,
                "shape-id": (typeof(superGroup) != 'undefined') ? superGroup.id : shape.id,
                "params": {"width": width, "height": height}
            });
        };


        self.undoHandler = function(e) {

            var undoHistory = self.undoHistory;

            var history_length = undoHistory.length;
            if (history_length == 0) {
                return;
            }

            var superGroup = null;
            var action = undoHistory.pop();
            switch(action.type) {
                case "add":
                    var shape = action.shape;
                    superGroup = shape.getGroup();

                    // Handle undo ADD
                    // self.deleteShape(shape);

                    if (typeof(superGroup) != 'undefined') {
                        self.editor.deleteShape(superGroup, null, true);
                    }
                    else {
                        self.editor.deleteShape(shape, null, true);
                    }
                    self.editor.setMode('select');
                    break;

                case "delete":
                    var shape_id = action["shape-id"];
                    if (typeof(shape_id) != 'undefined') {

                        shape = self.editor.addShape({
                            id: shape_id
                        });
                        shape.id = shape_id;

                        // Show he cloned object
                        superGroup = shape.getGroup();
                        (typeof(superGroup) != 'undefined') ? shape.group.show() : shape.show();

                        self.editor.setMode("select");
                    }

                    break;

                case "move":
                    var shape = action.shape,
                        params = action.params;
                    superGroup = shape.getGroup();


                    if (typeof(superGroup) != 'undefined') {
                        self.editor.move(superGroup, params.x, params.y);
                        self.editor.newTracker(superGroup);
                    }
                    else {
                        self.editor.move(shape, params.x, params.y);
                        self.editor.newTracker(shape);
                    }
                    self.editor.setMode('select');
                    break;

                case "scale":
                    var shape = action.shape,
                        params = action.params;
                    superGroup = shape.getGroup();

                    if (typeof(superGroup) != 'undefined') {
                        self.editor.resize(superGroup, params.width, params.height);
                        self.editor.newTracker(superGroup);
                    }
                    else {
                        var bbox = shape.getBBox();
                        self.editor.resize(shape, params.width, params.height);
                        self.editor.newTracker(shape);
                    }

                    break;
            }
        };
    };

})(jQuery, Raphael);