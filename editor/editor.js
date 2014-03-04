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
        "fill": "#ffffff",
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
          "hotspot": "<g><rect x=\"55\" y=\"52\" opacity=\"0.49\" fill=\"#ED1C24\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"123\" height=\"46\" \/><\/g>",
          "rounded_rect": "<g><g style=\"cursor: move;\"><rect stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" x=\"180\" y=\"130\" width=\"120\" height=\"60\" rx=\"9\" ry=\"9\" stroke-width=\"2\" style=\"cursor: move;\"><\/rect><\/g><\/g>",
          "person": "<g><g><path stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M 180 220 C 180 196 180 184 200 184 C 186.66666666666666 184 186.66666666666666 160 200 160 C 213.33333333333334 160 213.33333333333334 184 200 184 C 220 184 220 196 220 220 Z\"><\/path><\/g><\/g>",
          "cloud": "<g><path stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" stroke-width=\"2\" stroke-linejoin=\"round\" d=\"M 410 180 C 386 180 380 200 399.2 204 C 380 212.8 401.6 232 417.2 224 C 428 240 464 240 476 224 C 500 224 500 208 485 200 C 500 184 476 168 455 176 C 440 164 416 164 410 180 Z\"><\/path><\/g>",
          "cylinder": "<g><path stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" stroke-width=\"2\" d=\"M 130 166 C 130 144.66666666666666 190 144.66666666666666 190 166 L 190 214 C 190 235.33333333333331 130 235.33333333333331 130 214 Z\"><\/path><path stroke=\"#000000\" fill=\"none\" stroke-width=\"2\" d=\"M 130 166 C 130 182 190 182 190 166 \"><\/path><\/g>",
          "arrow": "<g style=\"cursor: move;\"><path stroke=\"#000000\" fill=\"none\" pointer-events=\"visibleStroke\" d=\"M 58 74 L 293 74 \" stroke-width=\"1\" style=\"cursor: move;\"><\/path><path stroke=\"#000000\" stroke-opacity=\"1\" fill=\"#000000\" fill-opacity=\"1\" d=\"M 300.79008 74.49999999999999 L 290.71008 79.53999999999999 L 293.23008 74.49999999999999 L 290.71008 69.45999999999998 z\" stroke-width=\"1.44\"><\/path><\/g>",
          "box": "<g><g style=\"cursor: move;\"><path stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" stroke-width=\"2\" d=\"M 140 80 L 240 80 L 260 100 L 260 160 L 160 160 L 140 140 L 140 80 Z\" style=\"cursor: move;\"><\/path><path stroke=\"#000000\" fill=\"none\" stroke-width=\"2\" d=\"M 160 160 L 160 100 L 140 80 M 160 100 L 260 100 \"><\/path><\/g><\/g>",
          "balloon_msg": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><path stroke-width=\"2\" stroke=\"#000000\" d=\"M 233.38347527928326 126.25407166123779A 8.848578697046786,9.120521172638437 0 1,1 233.38347527928326,109.15309446254072A 13.27286804557018,13.680781758957655 0 0,1 256.6109943590311,100.03257328990227A 15.485012719831875,15.960912052117266 0 0,1 285.36887512443315,100.03257328990227A 13.27286804557018,13.680781758957655 0 0,1 307.4903218670501,109.15309446254072A 8.848578697046786,9.120521172638437 0 1,1 307.4903218670501,126.25407166123779A 13.27286804557018,13.680781758957655 0 0,1 284.2628027873023,134.2345276872964A 15.485012719831875,15.960912052117266 0 0,1 257.7170666961619,134.2345276872964A 11.060723371308484,9.120521172638437 0 0,1 233.38347527928326,126.25407166123779Z\" stroke-linejoin=\"round\"><\/path><ellipse cx=\"236.70169229067582\" cy=\"145.63517915309447\" rx=\"6.63643402278509\" ry=\"3.078175895765473\" stroke-width=\"2\" stroke=\"#000000\" stroke-linejoin=\"miter\"><\/ellipse><ellipse cx=\"228.95918593075987\" cy=\"153.0456026058632\" rx=\"4.203074881097224\" ry=\"2.0521172638436482\" stroke-width=\"2\" stroke=\"#000000\" stroke-linejoin=\"miter\"><\/ellipse><ellipse cx=\"222.65457360911404\" cy=\"158.51791530944624\" rx=\"2.6545736091140357\" ry=\"1.4820846905537461\" stroke-width=\"2\" stroke=\"#000000\" stroke-linejoin=\"miter\"><\/ellipse><\/g>",
          "text_1": "<g><text text-decoration=\"none\" x=\"100\" y=\"100\" style=\"pointer-events: all\" font-size=\"12\" templated=\"0\">Text<\/text><\/g>",
          "link": "<g><text x=\"100\" y=\"100\" style=\"pointer-events: all\" fill=\"#0000FF\" font-size=\"14\" templated=\"0\">Link<\/text><\/g>",
          "button": "<g><polygon fill=\"#070808\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" points=\"204.331,71.999 134.999,71.999 54.331,71.999    54.331,42.666 204.331,42.666  \" \/><rect x=\"49.947\" y=\"33.999\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"149.083\" height=\"32.667\" \/><text transform=\"matrix(1 0 0 1 109.249 57.332)\" font-family=\"\'ArialMT\'\" font-size=\"18\" text-anchor=\"middle\" templated=\"0\">Button<\/text><\/g>",
          "textbox": "<g><rect x=\"86.167\" y=\"65\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"255.833\" height=\"41.667\" \/><text transform=\"matrix(1 0 0 1 97.834 93.3335)\" font-family=\"\'ArialMT\'\" font-size=\"12\" templated=\"0\">TextBox<\/text><\/g>",
          "dropdown": "<g><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"97\" y1=\"56.667\" x2=\"195.333\" y2=\"56.667\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"97\" y1=\"56.667\" x2=\"97\" y2=\"92.5\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"97\" y1=\"92.5\" x2=\"317\" y2=\"88.333\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"195.333\" y1=\"56.667\" x2=\"312.834\" y2=\"53.333\" \/><path fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M312.834,88.333\" \/><path fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M312.834,53.333\" \/><path fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M344.5,53.333\" \/><path fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M312.834,53.333\" \/><path fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M344.5,88.333\" \/><path fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M344.5,53.333\" \/><path fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M344.5,88.333\" \/><path fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M312.834,88.333\" \/><rect x=\"312.834\" y=\"53.333\" fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"33\" height=\"35.182\" \/><path stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M328.501,56.042c-1.744,3.655-3.455,7.685-4.061,11.538  c2.969-0.52,6.598-1.065,9.787-0.831c-1.086-3.454-3.684-5.85-5.727-9.041\" \/><path stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M329.384,83.958c1.996-3.523,3.986-7.424,4.861-11.225  c-2.998,0.31-6.656,0.599-9.822,0.142c0.842,3.521,3.265,6.094,5.078,9.42\" \/><text transform=\"matrix(0.8112 0 0 1 103.667 81.957)\" font-family=\"\'ArialMT\'\" font-size=\"14\" templated=\"0\">Dropdown<\/text><\/g>",
          "image_1": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><rect x=\"400\" y=\"300\" width=\"100\" height=\"100\" fill=\"none\" stroke=\"none\" stroke-width=\"2\"><\/rect><rect x=\"400\" y=\"300\" width=\"100\" height=\"100\" fill=\"#ffffff\" stroke=\"#000000\" stroke-linejoin=\"miter\" stroke-width=\"2\"><\/rect><path fill=\"none\" stroke=\"#000000\" d=\"M 400 400L 500 300\" stroke-linejoin=\"miter\" stroke-width=\"2\"><\/path><path fill=\"none\" stroke=\"#000000\" d=\"M 400 300L 500 400\" stroke-linejoin=\"miter\" stroke-width=\"2\"><\/path><\/g>",
          "progressbar": "<g><polyline fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" points=\"182.999,58.077 83.769,59.616 83.769,88.077    228.384,88.077 228.384,58.077 172.23,58.077  \" \/><line fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"228.384\" y1=\"58.077\" x2=\"305\" y2=\"58.077\" \/><line fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"228.384\" y1=\"88.077\" x2=\"305\" y2=\"88.077\" \/><line fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"305\" y1=\"58.077\" x2=\"305\" y2=\"88.077\" \/><\/g>",
          "button_bar": "<g><g><polygon fill=\"#000000\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" points=\"245,68.079 39.27,66.079 39.27,39.694 245,40.233   \" \/><polygon fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" points=\"35.27,62.694 35.27,40.386 101.424,38.848     101.424,62.694   \" \/><polyline fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" points=\"166.039,38.348 200.654,38.348 242.193,38.348     241.193,62.194 166.039,62.194   \" \/><polyline fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" points=\"166.039,62.694 101.424,62.694 101.424,38.848     166.039,38.848   \" \/><line stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"166.039\" y1=\"38.156\" x2=\"166.039\" y2=\"63.002\" \/><\/g><text transform=\"matrix(1 0 0 1 55.1157 56.6162)\" font-family=\"\'ArialMT\'\" font-size=\"14\" templated=\"0\">One<\/text><text transform=\"matrix(1 0 0 1 120.5073 56.6162)\" font-family=\"\'ArialMT\'\" font-size=\"14\" templated=\"0\">Two<\/text><text transform=\"matrix(1 0 0 1 185.8296 56.6162)\" font-family=\"\'ArialMT\'\" font-size=\"14\" templated=\"0\">Three<\/text><\/g>",
          "arrow_1": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><path stroke-width=\"2\" stroke=\"#000000\" d=\"M 140 90L 198.6974358974359 90L 198.6974358974359 70L 237 105L 198.6974358974359 140L 198.6974358974359 120L 140 120Z\" stroke-linejoin=\"miter\"><\/path><\/g>",
          "rounded_arrow": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><path stroke-width=\"2\" stroke=\"#000000\" d=\"M 107.99299041335944 127L 107.99299041335944 78A 4.999484589217606,5 0 0,0 102.99350582414183,73L 77.99608287805381 73L 77.99608287805381 86L 40 58L 77.99608287805381 30L 77.99608287805381 43L 102.99350582414183 43A 34.99639212452324,35 0 0,1 136.99000103082156,78L 136.99000103082156 127Z\" stroke-linejoin=\"miter\"><\/path><\/g>",
          "up_down_arrow": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><path stroke-width=\"2.88\" stroke=\"#000000\" d=\"M 64.8 105.12L 43.199999999999996 105.12L 86.39999999999999 152.64000000000001L 129.6 105.12L 108 105.12L 108 61.92L 129.6 61.92L 86.39999999999999 14.399999999999999L 43.199999999999996 61.92L 64.8 61.92Z\" stroke-linejoin=\"miter\"><\/path><\/g>",
          "three_direction_arrow": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><path stroke-width=\"2.88\" stroke=\"#000000\" d=\"M 99.072 84.96L 99.072 56.16L 86.17846153846153 56.16L 113.39815384615383 28.799999999999997L 140.61784615384616 56.16L 127.72430769230769 56.16L 127.72430769230769 84.96L 156.37661538461538 84.96L 156.37661538461538 72L 182.88 99.36L 156.37661538461538 126.72L 156.37661538461538 113.75999999999999L 99.072 113.75999999999999L 70.4196923076923 113.75999999999999L 70.4196923076923 126.72L 43.199999999999996 99.36L 70.4196923076923 72L 70.4196923076923 84.96Z\" stroke-linejoin=\"miter\"><\/path><\/g>",
          "four_direction_arrow": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><path stroke-width=\"2.88\" stroke=\"#000000\" d=\"M 99.072 84.67199999999998L 99.072 56.01969230769229L 86.17846153846153 56.01969230769229L 113.39815384615383 28.79999999999998L 140.61784615384616 56.01969230769229L 127.72430769230769 56.01969230769229L 127.72430769230769 84.67199999999998L 156.37661538461538 84.67199999999998L 156.37661538461538 71.77846153846151L 182.88 98.99815384615383L 156.37661538461538 126.21784615384614L 156.37661538461538 113.32430769230767L 127.72430769230769 113.32430769230767L 127.72430769230769 141.97661538461537L 140.61784615384616 141.97661538461537L 113.39815384615383 168.48L 86.17846153846153 141.97661538461537L 99.072 141.97661538461537L 99.072 113.32430769230767L 70.4196923076923 113.32430769230767L 70.4196923076923 126.21784615384614L 43.199999999999996 98.99815384615383L 70.4196923076923 71.77846153846151L 70.4196923076923 84.67199999999998Z\" stroke-linejoin=\"miter\"><\/path><\/g>",
          "curved_arrow_ccw": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><path stroke-width=\"2.88\" stroke=\"#000000\" d=\"M 168.48 118.08L 168.48 74.88A 43.2,43.199999999999996 0 0,0 76.32,74.88L 95.04 74.88L 61.92 118.08L 28.799999999999994 74.88L 47.519999999999996 74.88A 46.080000000000005,46.08 0 0,1 93.60000000000001,28.799999999999997L 122.4 28.799999999999997A 43.2,43.199999999999996 0 0,0 105.12,33.12A 43.2,43.199999999999996 0 0,1 141.12,74.88L 141.12 118.08Z\" stroke-linejoin=\"miter\"><\/path><\/g>",
          "video_ctl": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><rect x=\"39.99999999999999\" y=\"29.999999999999982\" width=\"309.99999999999994\" height=\"199.99999999999997\" rx=\"3.101851851851851\" ry=\"3.101851851851851\" stroke-width=\"1\" fill=\"#fafafa\" stroke=\"#000000\" stroke-linejoin=\"miter\"><\/rect><path stroke-width=\"2.222222222222222\" fill=\"none\" stroke=\"#2c457e\" d=\"M 47.74999999999999 44.814814814814795L 342.24999999999994 44.814814814814795\" stroke-linejoin=\"miter\" stroke-linecap=\"round\"><\/path><rect x=\"39.99999999999999\" y=\"29.999999999999982\" width=\"309.99999999999994\" height=\"199.99999999999997\" rx=\"3.101851851851851\" ry=\"3.101851851851851\" stroke-width=\"1\" fill=\"none\" stroke=\"#000000\" stroke-linejoin=\"miter\" stroke-linecap=\"butt\"><\/rect><rect x=\"47.74999999999999\" y=\"52.2222222222222\" width=\"294.49999999999994\" height=\"148.14814814814812\" stroke-width=\"1\" fill=\"#999999\" stroke=\"#000000\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/rect><path stroke-width=\"2.9629629629629624\" fill=\"#cccccc\" stroke=\"#000000\" d=\"M 179.49999999999997 111.48148148148145L 210.49999999999997 126.29629629629626L 179.49999999999997 141.11111111111106Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><ellipse cx=\"59.37499999999999\" cy=\"215.18518518518513\" rx=\"11.624999999999998\" ry=\"11.111111111111109\" stroke-width=\"1\" fill=\"#999999\" stroke=\"#999999\" stroke-linejoin=\"miter\" stroke-linecap=\"butt\"><\/ellipse><ellipse cx=\"86.49999999999999\" cy=\"215.18518518518513\" rx=\"11.624999999999998\" ry=\"11.111111111111109\" stroke-width=\"1\" fill=\"#999999\" stroke=\"#999999\" stroke-linejoin=\"miter\" stroke-linecap=\"butt\"><\/ellipse><ellipse cx=\"113.62499999999999\" cy=\"215.18518518518513\" rx=\"11.624999999999998\" ry=\"11.111111111111109\" stroke-width=\"1\" fill=\"#999999\" stroke=\"#999999\" stroke-linejoin=\"miter\" stroke-linecap=\"butt\"><\/ellipse><ellipse cx=\"140.74999999999997\" cy=\"215.18518518518513\" rx=\"11.624999999999998\" ry=\"11.111111111111109\" stroke-width=\"1\" fill=\"#999999\" stroke=\"#999999\" stroke-linejoin=\"miter\" stroke-linecap=\"butt\"><\/ellipse><ellipse cx=\"167.87499999999997\" cy=\"215.18518518518513\" rx=\"11.624999999999998\" ry=\"11.111111111111109\" stroke-width=\"1\" fill=\"#999999\" stroke=\"#999999\" stroke-linejoin=\"miter\" stroke-linecap=\"butt\"><\/ellipse><path stroke-width=\"2.9629629629629624\" fill=\"none\" stroke=\"#999999\" d=\"M 187.24999999999997 215.1851851851851L 287.99999999999994 215.1851851851851\" stroke-linejoin=\"miter\" stroke-linecap=\"round\"><\/path><ellipse cx=\"194.99999999999997\" cy=\"215.1851851851851\" rx=\"3.8749999999999996\" ry=\"3.703703703703703\" stroke-width=\"1\" fill=\"#999999\" stroke=\"#999999\" stroke-linejoin=\"miter\" stroke-linecap=\"butt\"><\/ellipse><path stroke-width=\"1.4814814814814812\" fill=\"#cccccc\" stroke=\"#cccccc\" d=\"M 59.374999999999986 210.74074074074068L 59.374999999999986 219.62962962962956L 52.39999999999999 215.1851851851851Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"#cccccc\" stroke=\"#cccccc\" d=\"M 67.12499999999999 210.74074074074068L 67.12499999999999 219.62962962962956L 60.14999999999999 215.1851851851851Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"none\" stroke=\"#cccccc\" d=\"M 51.62499999999999 210.74074074074068L 51.62499999999999 219.62962962962956\" stroke-linejoin=\"miter\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"#cccccc\" stroke=\"#cccccc\" d=\"M 85.725 210.74074074074068L 85.725 219.62962962962956L 78.74999999999999 215.1851851851851Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"#cccccc\" stroke=\"#cccccc\" d=\"M 93.475 210.74074074074068L 93.475 219.62962962962956L 86.49999999999999 215.1851851851851Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"none\" stroke=\"#cccccc\" d=\"M 51.62499999999999 210.74074074074068L 51.62499999999999 219.62962962962956\" stroke-linejoin=\"miter\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"#cccccc\" stroke=\"#cccccc\" d=\"M 109.74999999999997 207.77777777777771L 109.74999999999997 222.59259259259252L 121.37499999999997 215.1851851851851Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"#cccccc\" stroke=\"#cccccc\" d=\"M 140.74999999999997 210.74074074074068L 140.74999999999997 219.62962962962956L 147.725 215.1851851851851Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"none\" stroke=\"#cccccc\" d=\"M 175.62499999999997 210.74074074074068L 175.62499999999997 219.62962962962956\" stroke-linejoin=\"miter\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"#cccccc\" stroke=\"#cccccc\" d=\"M 132.99999999999997 210.74074074074068L 132.99999999999997 219.62962962962956L 139.975 215.1851851851851Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"#cccccc\" stroke=\"#cccccc\" d=\"M 167.87499999999997 210.74074074074068L 167.87499999999997 219.62962962962956L 174.85 215.1851851851851Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"#cccccc\" stroke=\"#cccccc\" d=\"M 160.12499999999997 210.74074074074068L 160.12499999999997 219.62962962962956L 167.09999999999997 215.1851851851851Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><path stroke-width=\"1\" fill=\"#999999\" stroke=\"#999999\" d=\"M 295.74999999999994 211.4814814814814L 295.74999999999994 218.88888888888883L 299.62499999999994 218.88888888888883L 303.49999999999994 222.59259259259252L 303.49999999999994 207.77777777777771L 299.62499999999994 211.4814814814814Z\" stroke-linejoin=\"round\" stroke-linecap=\"butt\"><\/path><rect x=\"326.74999999999994\" y=\"211.4814814814814\" width=\"11.624999999999998\" height=\"7.407407407407406\" stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/rect><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 307.37499999999994 215.1851851851851L 312.79999999999995 215.1851851851851\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 306.59999999999997 210.74074074074068L 311.24999999999994 208.51851851851845\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 306.59999999999997 219.62962962962956L 311.24999999999994 221.8518518518518\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 322.87499999999994 209.25925925925918L 325.2 210.74074074074068\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 324.42499999999995 209.25925925925918L 322.87499999999994 209.25925925925918L 322.87499999999994 210.3703703703703Z\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 322.87499999999994 219.99999999999994L 322.87499999999994 221.11111111111106L 324.42499999999995 221.11111111111106Z\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 340.7 221.11111111111106L 342.24999999999994 221.11111111111106L 342.24999999999994 219.99999999999994Z\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 342.24999999999994 210.3703703703703L 342.24999999999994 209.25925925925918L 340.7 209.25925925925918Z\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 325.2 219.62962962962956L 322.87499999999994 221.11111111111106\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 339.92499999999995 219.62962962962956L 342.24999999999994 221.11111111111106\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1\" fill=\"none\" stroke=\"#999999\" d=\"M 339.92499999999995 210.74074074074068L 342.24999999999994 209.25925925925918\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"none\" stroke=\"#000000\" d=\"M 342.24999999999994 41.11111111111109L 334.49999999999994 33.70370370370369\" stroke-linejoin=\"miter\" stroke-linecap=\"round\"><\/path><path stroke-width=\"1.4814814814814812\" fill=\"none\" stroke=\"#000000\" d=\"M 342.24999999999994 33.70370370370369L 334.49999999999994 41.11111111111109\" stroke-linejoin=\"miter\" stroke-linecap=\"round\"><\/path><text fill=\"#000000\" font-family=\"Arial,Helvetica\" font-size=\"10.370370370370368\" stroke=\"none\" x=\"51.62499999999999\" font-weight=\"bold\" text-anchor=\"start\" y=\"38.70370370370369\" dy=\"0.5ex\" templated=\"0\">Video Name<\/text><\/g>",
          "social_comment": "<g><g id=\"Layer_1_1_\" display=\"none\"><path display=\"inline\" d=\"M66.016,81.127L53.93,63H16V18h68v45H69.641L66.016,81.127z M20,59h36.07l7.914,11.873L66.359,59H80V22   H20V59z\" \/><\/g><g id=\"Layer_2\"><path fill=\"#000\" d=\"M72,18H28c-6.627,0-12,5.373-12,12v21c0,6.627,5.373,12,12,12h26.025l10.843,16.407L68.357,63H72c6.627,0,12-5.373,12-12   V30C84,23.373,78.627,18,72,18z\" \/><\/g><\/g>",
          "social_share": "<g><path id=\"sharethis-circle-outline-icon\" fill=\"#000\" d=\"M49.921,9.134c10.124,0,19.644,3.943,26.804,11.102  c7.159,7.16,11.102,16.679,11.102,26.805c0,10.125-3.942,19.645-11.102,26.803c-7.16,7.16-16.681,11.104-26.804,11.104  c-10.125,0-19.644-3.943-26.803-11.104c-7.16-7.158-11.103-16.678-11.103-26.803c0-10.126,3.943-19.646,11.103-26.805  C30.278,13.077,39.796,9.134,49.921,9.134 M49.921,0C23.942,0,2.881,21.061,2.881,47.042c0,25.979,21.061,47.041,47.041,47.041  c25.979,0,47.04-21.062,47.04-47.041C96.961,21.061,75.9,0,49.921,0L49.921,0z M62.637,53.896c-2.701,0-5.129,1.164-6.809,3.017  l-16.445-8.119c0.098-0.535,0.151-1.086,0.151-1.65c0-0.113-0.005-0.225-0.009-0.339l17.012-8.936  c1.623,1.442,3.758,2.318,6.1,2.318c5.075,0,9.189-4.115,9.189-9.19c0-5.077-4.114-9.191-9.189-9.191  c-5.076,0-9.191,4.114-9.191,9.191c0,0.378,0.025,0.751,0.07,1.119l-16.529,8.682c-1.673-1.752-4.03-2.845-6.644-2.845  c-5.076,0-9.191,4.116-9.191,9.191c0,5.076,4.115,9.189,9.191,9.189c2.138,0,4.104-0.73,5.665-1.955l17.44,8.61  c-0.001,0.033-0.003,0.066-0.003,0.101c0,5.076,4.113,9.19,9.189,9.19s9.19-4.116,9.19-9.19  C71.826,58.01,67.712,53.896,62.637,53.896z\" \/><\/g>",
          "social_like": "<g><g><path fill=\"#000\" d=\"M86.667,6H13.333C5.013,6,0,10.624,0,19.333v43.333C0,71.376,5.013,76,13.333,76l13.333-0.104c0,6.203,0,13.897,0,20.104    H30c5.495-6.501,11.175-13.499,16.667-20h40C94.986,76,100,71.376,100,62.667V19.333C100,10.624,94.986,6,86.667,6z     M93.333,62.666c0,3.667-3,6.667-6.667,6.667H13.333c-3.667,0-6.667-3-6.667-6.667V19.333c0-3.667,3-6.667,6.667-6.667h73.333    c3.667,0,6.667,3,6.667,6.667V62.666z\" \/><path fill=\"#000\" d=\"M21.667,42.821C21.56,42.068,20.046,40.09,20,39.333c-0.091-1.372,1.947-2.817,3.333-3.333h13.333    c0-6.667-2.493-8.125-3.333-10c-1.23-2.75-1.56-4.793,0-6.667C35.238,17.043,39.925,14.976,40,16    c0.518,7.43,2.064,11.009,4.141,12.477c1.25,0.886,2.34,1.655,2.914,3.001c3.544,8.265,4.909,10.9,6.279,11.188h3.334l0,0v16.667    l-10,3.334c0,0-13.333,0-16.667,0c-1.341,0-5.426-2.567-5.947-3.708c-0.306-0.654,0.107-2.203-0.248-2.836    c-0.524-0.934-2.737-2.105-2.731-3.38c0-0.905,1.152-2.476,1.064-3.379C22.064,48.456,20,46.907,20,46    C20.006,45.048,21.807,43.764,21.667,42.821z\" \/><\/g><path fill=\"#000\" d=\"M60,59.333c0,1.179,1.984,3.334,3.333,3.334h3.334c1.349,0,3.333-2.155,3.333-3.334V42.667   c0-1.178-1.984-3.333-3.333-3.333h-3.334c-1.349,0-3.333,2.151-3.333,3.333V59.333z\" \/><\/g>",
          "social_signup": "<g><path fill=\"#000\" d=\"M95.266,63H80V47.264C80,47.129,79.482,47,79.35,47H68.105C67.973,47,68,47.129,68,47.264V63H52.188  C52.057,63,52,63.049,52,63.182v11.243C52,74.559,52.057,75,52.188,75H68v15.343C68,90.477,67.973,91,68.105,91H79.35  c0.135,0,0.65-0.523,0.65-0.657V75h15.266C95.4,75,96,74.559,96,74.425V63.182C96,63.049,95.4,63,95.266,63z\" \/><path fill=\"#000\" d=\"M52.188,77C50.953,77,50,75.66,50,74.425V63.182C50,61.945,50.953,61,52.188,61H66v-9.745  c-3.917-4.638-9.15-8.166-15.157-9.99c6.024-3.312,10.108-9.683,10.108-17.002c0-10.727-8.764-19.422-19.57-19.422  s-19.568,8.696-19.568,19.422c0,7.32,4.082,13.691,10.109,17.002C18.876,45.225,9.4,57.154,9.4,71.261  c0,17.339,14.318,20.323,31.98,20.323c9.903,0,18.753-0.939,24.619-4.818V77H52.188z\" \/><\/g>",
		  "webui_map": "<g stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" style=\"cursor: move;\"><rect x=\"49.99999999999999\" y=\"29.999999999999996\" width=\"259.99999999999994\" height=\"199.99999999999997\" fill=\"none\" stroke=\"none\" \/><rect x=\"49.99999999999999\" y=\"29.999999999999996\" width=\"258.96414342629475\" height=\"199.20318725099597\" stroke-width=\"1\" fill=\"#ffffff\" stroke=\"#000000\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 65.53784860557768 29.999999999999996L 63.2934910588116 33.32004501525149L 56.215141258014796 30.132794019235554Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 55.86985918630166 44.47542350130726L 64.32934763251677 44.74103306306027L 63.811419345664184 49.654706369833164L 72.27092850901084 51.11553505509214L 69.50863050104267 67.05179003517182L 60.18592133769606 65.45816453716385L 59.495357194269786 70.10622828218374L 51.38115081976781 69.30941553317976L 53.45286396717817 62.53650716664589L 50.34529424606263 61.872507166645924L 50.34529424606263 53.1075669276021L 55.524577114588524 49.92031593158616Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 72.61620022215821 39.561750194534376L 69.85392293132158 37.30410876027141L 74.16998508271598 30.39840358098856L 90.74369026199884 29.999999999999996Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 76.75962651697893 43.94422031405628L 93.50598826996702 35.57768644951445L 97.82205042136141 41.81937569254231L 79.5219245249471 50.318722306088155Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 106.62683129785543 44.342626688558276L 112.66933488351282 52.04514461684511L 79.1766320946682 65.59096134991283L 80.90305281179964 62.27091354114792L 81.24834524207854 56.16200517461402Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 99.37583528191918 32.39043545349852L 105.24568229387134 39.561750194534376L 109.90703687554466 37.30410876027141L 119.05711018231759 49.654706369833164L 135.80345121817413 43.54581393955429L 127.68925520223792 30.265590831984543L 103.69189743331358 30.132794019235554Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 142.8818113775367 41.68657887979332L 135.80345121817413 30.132794019235554L 155.31209026199883 30.132794019235554L 168.0876615767399 35.71048326226344L 154.79416197514627 45.27223625031125Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 149.26958667634145 49.52190955708417L 147.0252376723574 49.12350318258218L 142.70917552096302 41.28817250529133L 151.34129982375183 39.16334382003238L 156.17531097913033 44.47542350130726Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 175.51129344924985 32.2576227044945L 172.57635958470797 30.265590831984543L 177.7556424532339 30.132794019235554Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 182.58965360861242 37.4369055730204L 179.13679145721798 35.04646732600845L 185.69722332972796 30.132794019235554L 193.81141934566415 30.132794019235554Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 213.49269424606257 34.11685776425547L 207.9681396643893 30.132794019235554L 218.3267054014411 30.265590831984543Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 220.05312611857255 37.569718322024414L 228.68527113849288 31.062403580988526L 231.44754842932952 31.85921632999251L 227.99468627793507 40.09295338178535Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 201.9256360787319 51.64673824234312L 216.945556397457 40.88976613078934L 227.3041221345088 45.00662668855824L 219.01726954486736 62.8021167283989Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 208.83133966438925 46.733064935570226L 216.945556397457 41.15537569254234L 227.3041221345088 45.00662668855824L 223.505988269967 52.709160553100105Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 233.86455400701877 43.147407565052305L 236.9721237281343 35.71048326226344L 248.36654603889127 40.75696931804035L 238.0079803018395 48.857893620829174Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 257.34396277195896 34.78087370051047L 249.74767432574382 29.999999999999996L 263.38646635761637 29.999999999999996Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 264.42232293132156 35.04646732600845L 269.7742416564211 31.32801314274153L 284.1035978317199 38.632124696526375L 278.06109424606257 42.61618844154629Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 282.0318846843096 48.459487246327186L 290.4913731305247 42.48339162879731L 308.96415560064423 52.1779414295941L 308.79149902693905 62.93491354114788Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 290.1460807002458 34.91367051325946L 280.6507356803255 30.265590831984543L 292.0451579910825 30.132794019235554L 294.11687113849285 31.593622704494535Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 302.576359584708 34.38246732600848L 307.75564245323386 30.265590831984543L 309.3094273137916 30.39840358098856L 308.96415560064423 38.3665310710284Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 240.9428934492498 52.97475417859808L 259.9336042062219 37.9681246965264L 274.09030380781553 45.40503306306024L 246.6401046046283 62.66931991564991Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 232.310769146461 54.037176489355076L 242.3240424532339 66.78618047341881L 232.8286974333136 72.49666652919569L 224.88711655681954 66.52057091166581Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 261.8326814970586 60.81008485588893L 275.1261603815207 52.1779414295941L 285.65738269227774 57.88844342162601L 278.92431496319404 69.04382190768177Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 283.758305401441 71.6998537801917L 290.6640089870984 60.27888166863795L 306.3745141663813 68.37980597142678L 290.8366655608036 75.68391752521163Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 297.0518050030347 78.33996533397658L 309.13679145721795 72.49666652919569L 308.79149902693905 84.31606095150646Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 283.58566954486736 87.7689215092754L 290.8366655608036 82.72243545349849L 307.23771416638124 90.82335975628732L 298.4329332898872 97.4634713100722Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 256.1354703416801 77.8087621467256L 260.4515324930745 67.8486027841758L 285.65738269227774 79.80079401923557L 270.63746237355264 86.97210876027141Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 270.1195340867 99.72111274433516L 272.70917552096296 94.40901712680525L 270.63746237355264 91.48737569254232L 278.75165838948885 90.42495338178533L 294.2895069950665 100.78351911883712L 287.2111675528355 108.35324023437497Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 246.4674687480546 71.96546334194471L 255.27224962454864 64.66135178815986L 256.99867034168005 65.45816453716385L 256.4807420548275 67.71579003517178L 251.6467516165805 75.41832389971366Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 221.2616185488514 85.37848326226344L 242.84197074008648 74.48869840170565L 247.8486177520387 77.94155895947459L 234.03718986359246 87.63610876027138L 238.1806161584132 91.48737569254232L 232.65604085960837 95.07303306306025Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 239.90703687554463 88.43292150927536L 248.71181775203866 80.99601314274153L 256.1354703416801 85.64407688776143L 247.3306894651861 93.34661075230329Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 256.6533986285327 92.41698525429528L 260.6241683496482 88.69853107102837L 265.8034512181741 92.41698525429528L 264.9402512181741 97.33067449732322Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 253.89110062056454 108.48605298337898L 237.4900520149869 98.39308087182516L 242.1514065966602 95.60423625031123L 247.67596117833347 99.18989362082915L 251.9920440468594 96.26825218656622L 262.86853807076375 101.44753505509212Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 259.07038348909043 110.47808485588895L 267.52989265243707 104.10358286385707L 283.24037711458845 113.26692947740288L 281.3412998237518 116.32136772441481L 275.6440886683733 117.6493995969248Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 306.547150022955 100.65072230608813L 299.8140822938713 108.35324023437497L 309.13679145721795 112.07171035389692L 309.3094273137916 101.71314461684513Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 299.123518150445 124.42230796345866L 302.40372372813425 120.83665059294074L 309.13679145721795 122.56307290369769L 308.61886317036533 128.14076214672556Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 292.0451579910825 137.43690557302037L 295.6706559990506 129.33598127023154L 306.2018575926761 132.25762270449448L 300.33201058072393 138.89773425827934Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 279.9601715368992 164.39574222640684L 289.6281524133932 143.81140756505224L 297.397076716182 143.81140756505224L 308.2735707400864 147.2642681228212L 295.6706559990506 171.03585378019173Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 301.1952312978554 173.4262920272037L 304.82072930582353 166.3877740989168L 308.96415560064423 167.31738366066978L 308.96415560064423 176.61354302321962Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 307.23771416638124 162.40371035389688L 309.13679145721795 158.55244342162595L 309.13679145721795 162.40371035389688Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 271.67331894725777 183.91765457700444L 278.23373010263623 170.7702442184387L 308.96415560064423 183.12084182800047L 308.79149902693905 198.52589362082918Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 264.07703050104266 201.4475350550921L 269.7742416564211 189.76095338178536L 309.13679145721795 205.29877011485306L 308.96415560064423 217.51661872043073Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 259.76096834964824 213.13414860090882L 262.3506097839112 207.82203704712396L 309.3094273137916 223.75829202720365L 309.3094273137916 226.01590158895664L 305.8565858795287 227.21112071246262Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 257.8618910588116 218.18060278417576L 289.9734448436721 227.87518445748253L 289.11022412654063 229.0704035809885L 264.5949587878952 229.0704035809885L 253.89110062056454 226.41430796345864Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 235.7636105807239 227.47677808298053L 234.38248229387136 229.60155895947457L 209.34926795124184 229.0704035809885L 213.1474225329152 220.83661872043075Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 242.1514065966602 222.8286505929407L 219.88049026199886 215.65733585190486L 224.71448070024584 207.95486573238293L 246.1221763177757 215.12618047341877Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 248.02125360861237 209.68124023437497L 229.89376356877173 203.04116055310007L 233.86455400701877 197.46347131007218L 250.783530899449 203.173989238359Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 247.67596117833347 180.19920039373753L 259.24304006279567 185.51128007501242L 252.6826081902857 198.79148724632714L 237.3173954412817 193.74501712680527Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 254.92695719426973 177.4103557722236L 263.04117392733747 164.39574222640684L 268.0478209392897 166.91897728616777L 261.4873890667797 180.33199720648653Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 270.8100982301263 148.19387768457415L 274.953524524947 149.65470636983315L 269.94687751299483 161.07569441764193L 265.1128870747478 159.21645935788095Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 264.2496663576163 131.3280131427415L 269.60160579984745 122.8286824654507L 284.4488695448673 127.47674621047058L 280.9960281106044 135.57768644951443Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 259.76096834964824 139.03053107102835L 262.17795321020594 135.17928007501243L 278.57902253291513 140.49135975628732L 276.16201695522585 145.27223625031124Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 257.1713269153853 143.14740756505228L 261.314753210206 144.74103306306026L 255.79017791140123 154.568379676606L 250.95618747315424 152.84195736584908Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 255.44488548112233 136.3744991985184L 245.94954046120202 150.5843159315861L 239.90703687554463 148.06108087182517L 249.40240261259646 134.38246732600845Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 264.07703050104266 121.76626015469371L 257.34396277195896 132.25762270449448L 251.8193874731542 130.39840358098854L 257.8618910588116 120.03983784393675Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 251.9920440468594 118.0478059714268L 233.69189743331356 145.80343943756222L 224.19655241339325 141.81937569254228L 247.15803289148087 116.18857091166582Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 217.8087771145885 139.03053107102835L 212.80213010263628 136.9057023857694L 236.1089030110028 113.26692947740288L 240.07969344924985 114.32933585190484Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 229.54847113849283 108.88445935788097L 208.65870380781558 131.7264195172435L 202.4435643655845 123.09427609094867L 223.85125998311435 105.16598923835903Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 218.15404882773586 101.58033186784111L 197.09164564048493 119.37582190768175L 191.91236277195904 121.10224421843871L 178.9641556006443 123.35988565270168L 177.0650783098076 119.90702509493273L 183.45285360861237 117.2509932224228L 182.93492532175978 114.59494541365785L 211.24834524207853 96.00264262481322Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 189.32272133769607 121.76626015469371L 179.13679145721798 123.49268246545066L 177.0650783098076 119.77422828218374L 183.62551018231758 117.2509932224228L 183.28021775203868 114.59494541365785L 184.66136675602277 113.53252310290087Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 181.38114046120202 128.67196533397654L 195.88313249307453 126.14873027421562L 202.9614926524371 137.43690557302037L 188.2868647639909 142.21778206704428Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 191.7397061982538 147.66267449732317L 207.9681396643893 141.6865788797933L 213.32005838948888 144.34262668855825L 197.95484564048488 160.41167848138693Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 200.54448707474782 167.71579003517178L 219.88049026199886 146.6002521865662L 230.41169185562433 150.71712868059012L 207.1049189472578 180.59760676823953Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 211.07570938550484 185.24567051325943L 220.2257619751462 175.01991752521164L 237.3173954412817 181.3944195172435L 229.20319942534547 190.55776613078933Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 223.67862412654068 171.3014474056897L 236.6268312978554 154.568379676606L 252.1646799034331 160.14606891963393L 241.11555002295503 177.27754302321958Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 178.1009348835128 42.2177820670443L 193.1208552022379 52.97475417859808L 188.63213647713826 56.02920836186503L 176.8924424532339 48.32669043357819Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 197.95484564048488 57.09163067262202L 225.75033727395103 76.61354302321962L 219.01726954486736 79.53518445748256L 194.32934763251674 60.54447529413593Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 172.57635958470797 40.09295338178535L 170.84993886757653 49.92031593158616L 183.45285360861237 60.013272106884955L 175.6839293058235 65.05975816266186L 160.14608070024585 48.990690433578166Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 188.97742890741716 64.13013266465386L 215.39177153689923 83.78485776425548L 201.9256360787319 92.81539162879727L 180.69057631777574 70.90304103118773Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 175.6839293058235 74.88710477620764L 196.57371735363233 96.66665856106822L 181.38114046120202 106.759614736367L 169.81408229387137 103.97077011485305L 161.35459384765625 87.2377023857694Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 176.8924424532339 109.41566254513195L 171.02257472415022 108.087646608877L 169.64144643729767 103.43956692760207L 176.2018575926761 100.38511274433513L 181.8990687480546 106.62681792361802Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 147.54316595921 75.15271433796065L 160.83666556080365 101.04912868059013L 154.44886954486736 105.56439561286102L 129.07038348909046 101.31473824234313L 130.79682492335346 90.55776613078935L 137.3572360787319 87.2377023857694L 133.3864663576164 80.86320039373751Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 160.49137313052475 99.72111274433516L 162.3904504213614 103.3067701148531L 162.2177938476562 107.689240234375L 154.27623368829367 105.56439561286102L 152.89508468430958 105.43159880011204L 154.79416197514627 99.45550318258216Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 159.11022412654066 80.33199720648653L 154.79416197514627 71.6998537801917L 167.05180500303473 66.52057091166581L 170.15937472415027 69.97343146943474Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 153.24037711458848 66.52057091166581L 148.4063866763415 58.15403704712398L 155.31209026199883 54.037176489355076L 162.5630862779351 61.872507166645924Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 146.85260181578374 69.30941553317976L 129.93360420622196 76.61354302321962L 125.61754205482757 67.71579003517178L 141.84595480383152 61.34128804313991Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 140.81009823012633 56.29481792361804L 123.54582890741719 63.4661326646539L 118.8844743257439 56.42761473636702L 137.01196436558453 49.25629999533117Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 100.92962014247695 72.23107290369771L 95.57770141737737 65.85657091166584L 112.84197074008651 59.34925617062996L 117.5033253217598 65.05975816266186Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 114.56839145721796 71.56705696744272L 119.40240261259649 78.07435577222357L 110.25232930582357 81.92562270449451L 105.24568229387134 79.13677808298057L 105.76361058072393 74.88710477620764Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 91.43427512255666 67.98139959692479L 104.90041058072399 84.84726413875744L 96.26826556080364 88.83132788377736L 81.24834524207854 71.96546334194471Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 99.37583528191918 92.0185788797933L 108.1806161584132 87.50331194752239L 125.09961376797497 90.29215656903634L 121.64675161658053 100.78351911883712L 108.69854444526578 102.5099573658491Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 173.95750858869206 178.33996533397658L 193.63878348909049 168.37980597142678L 212.2842018157837 208.08761473636702L 208.65870380781558 211.14211672839886Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 165.84329185562433 175.6839175252116L 196.22842492335343 202.64275417859807L 186.5604233297279 201.71311274433512L 160.6640089870984 178.87116852122753Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 197.95484564048488 209.282833859873L 207.4502113775367 214.99335178815983L 199.85392293132156 229.0704035809885L 159.62815241339325 229.20315258497257Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 67.26428149705863 203.7051446168451L 88.15404882773589 221.3678537801917L 76.24169823012633 229.46880995549049L 57.596279903433114 229.20315258497257L 58.45950062056461 209.282833859873Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 49.99999999999999 215.25892947740286L 60.013285481122374 208.22044342162596L 73.82471336956861 219.77422828218374L 59.66799305084347 229.33598127023154L 50.17264803092318 229.60155895947457Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 63.98407591936941 201.04912868059012L 50.34529424606263 209.41566254513194L 50.34529424606263 197.72908087182518L 56.38778747315425 194.67462668855825Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 77.62284723411042 192.2841884415463L 72.96149265243712 187.76892150927537L 94.0239165568196 174.35590158895664L 93.6786241265407 170.63744740568973L 105.59097472415024 163.46613266465388L 111.11555002295506 164.52853903915585L 113.87782731379168 167.8486027841758Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 76.58699066040523 168.91100915867776L 87.29084882773594 178.60557489572957L 81.24834524207854 182.0584195172435L 70.02655878789525 172.7622760909487Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 84.35591496319408 164.39574222640684L 62.602926915385325 177.8087621467256L 50.17264803092318 165.45816453716384L 70.02655878789525 152.04514461684508Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 114.91368388749686 157.490037047124L 121.12882332972794 153.77156692760204L 127.86189105881161 159.48206891963395L 118.3665460388913 165.05975816266184L 114.74104803092317 162.2709135411479Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 75.89642651697896 74.62151115070967L 102.6560408596084 105.83000517461403L 97.9946862779351 109.01725617062996L 105.24568229387134 116.45418047341883L 102.6560408596084 118.0478059714268L 81.42098109865223 95.20582987580923L 84.87384325004668 93.47940756505227L 75.37849823012638 82.45682589174548L 66.22842492335346 86.97210876027141L 72.61620022215821 96.00264262481322L 68.8180663576164 97.7290808718252L 62.43029105881164 91.62017250529131L 63.98407591936941 84.18326413875748L 72.96149265243712 79.93359083198455Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 73.1341285090108 85.64407688776143L 79.1766320946682 91.75298525429533L 75.55113408670006 93.87781393955427L 70.37185121817416 87.1049055730204Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 68.30013807076381 102.77555099134707L 77.96813966438933 97.4634713100722L 93.33333169626178 113.39972629015188L 89.01726954486739 115.65736772441484L 76.06906237355265 103.97077011485305L 71.58034364845302 105.69720836186504Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 72.09827193530562 127.87515258497257L 70.37185121817416 126.81274621047062L 72.09827193530562 119.50861872043075L 84.1832791066204 120.03983784393675Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 67.78220978391121 126.6799334614666L 65.36520420622196 126.9455430232196L 59.66799305084347 120.30543146943472L 67.43691735363231 120.57104103118773Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 55.86985918630166 123.49268246545066L 63.46614763251682 128.53916852122757L 61.56707034168014 130.53120039373752L 54.66135639745703 127.6095589594746Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 57.596279903433114 116.45418047341883L 59.15006476399088 105.56439561286102L 64.84727591936937 105.56439561286102L 67.78220978391121 108.48605298337898L 66.40106077992714 116.98538366066981Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 60.87650619825387 95.07303306306025L 65.71049663650086 99.05709680808016L 60.53121376797496 100.65072230608813Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 54.14342811060444 103.70517648935508L 50.34529424606263 116.7197740989168L 50.690576317775765 103.3067701148531Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 100.41169185562435 121.5006505929407L 74.3426416564212 136.5072960112674L 76.24169823012633 138.36653107102836L 101.96547671618212 123.89108883995266Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 70.88977950502675 138.49932788377737L 72.09827193530562 139.69454700728335L 59.495357194269786 147.2642681228212L 58.804793050843514 146.0690489993152Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 91.26161854885143 136.9057023857694C 91.26161854885143 136.9057023857694 106.45419544128174 126.9455430232196 106.45419544128174 126.9455430232196C 106.45419544128174 126.9455430232196 121.99204404685943 139.82734382003233 121.99204404685943 139.82734382003233C 121.99204404685943 139.82734382003233 106.28153886757653 150.8499254933391 106.28153886757653 150.8499254933391C 106.28153886757653 150.8499254933391 103.17396914646099 148.85789362082915 103.17396914646099 148.85789362082915C 103.17396914646099 148.85789362082915 94.0239165568196 140.09295338178532 94.0239165568196 140.09295338178532C 94.0239165568196 140.09295338178532 91.08898269227774 137.0384991985184 91.08898269227774 137.0384991985184Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 87.9814129711622 139.29614063278134C 87.9814129711622 139.29614063278134 91.08898269227774 142.48339162879728 91.08898269227774 142.48339162879728C 91.08898269227774 142.48339162879728 98.51261456478768 151.5139414295941 98.51261456478768 151.5139414295941C 98.51261456478768 151.5139414295941 101.44754842932954 154.16997330210404 101.44754842932954 154.16997330210404C 101.44754842932954 154.16997330210404 87.11819225403072 163.59892947740286 87.11819225403072 163.59892947740286C 87.11819225403072 163.59892947740286 72.27092850901084 149.38909680808013 72.27092850901084 149.38909680808013C 72.27092850901084 149.38909680808013 88.32670540144112 139.29614063278134 88.32670540144112 139.29614063278134Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 54.31607432574389 131.85921632999248C 54.31607432574389 131.85921632999248 56.215141258014796 132.52323226624748 56.215141258014796 132.52323226624748C 56.215141258014796 132.52323226624748 62.08499862853273 139.69454700728335 62.08499862853273 139.82734382003233C 62.08499862853273 139.96015656903634 50.690576317775765 146.99865856106817 50.690576317775765 146.99865856106817C 50.690576317775765 146.99865856106817 50.34529424606263 134.64806095150644 50.34529424606263 134.64806095150644C 50.34529424606263 134.64806095150644 54.31607432574389 131.9920290789965 54.31607432574389 131.9920290789965Z\" stroke-linejoin=\"miter\" \/><ellipse cx=\"67.69588149705861\" cy=\"133.58565457700448\" rx=\"3.366533864541832\" ry=\"2.6560424701195213\" stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 74.68791336956856 129.73438764473354L 96.09562970422996 117.3837900351718L 98.51261456478768 120.17263465668574L 77.45021137753673 132.65602907899648Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 54.66135639745703 100.25231593158614L 56.90571576000684 93.21379800329927A 4.143426294820716,7.1713147410358555 0 0,0 50.34529424606263,92.2841884415463L 50.34529424606263 99.72111274433516L 54.48872054088334 100.38511274433513Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 50.690576317775765 82.3240290789965L 61.39443448510646 83.78485776425548L 59.66799305084347 90.55776613078935A 10.35856573705179,7.968127490039839 0 0,0 50.51793010263631,86.57370238576942L 50.51793010263631 82.0584195172435Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#d87146\" stroke=\"#d87146\" d=\"M 114.91368388749686 108.48605298337898A 51.792828685258954,39.840637450199196 0 0,1 137.87516436558448,108.087646608877A 51.792828685258954,39.840637450199196 0 0,1 156.86587512255662,112.73571035389688A 15.537848605577686,11.95219123505976 0 0,0 170.50464643729762,123.75829202720367L 182.58965360861242 144.60822031405624L 169.98671815044503 148.72509680808017L 176.8924424532339 162.2709135411479L 189.15006476399085 158.81805298337895L 193.81141934566415 168.64541553317977L 177.0650783098076 176.7463398359686L 165.67065599905064 167.0517900351718L 109.38910858869207 208.35327210688493L 93.6786241265407 195.47143943756222L 107.14475958470803 185.37848326226344A 20.71713147410358,15.936254980079678 0 0,0 129.2430400627957,180.59760676823953L 125.96281376797492 178.60557489572957L 132.177953210206 174.75430796345864L 134.24966635761635 176.4807302742156A 20.71713147410358,15.936254980079678 0 0,0 141.32802651697892,160.41167848138693L 126.48074205482752 150.05311274433512L 135.80345121817413 142.88179800329928L 112.4966783098076 121.63346334194472L 120.95618747315424 114.99335178815984L 114.91368388749686 108.4861007921439Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffca8c\" stroke=\"#d87146\" d=\"M 306.44356436558445 140.09295338178532L 309.13679145721795 136.7463398359686L 309.13679145721795 141.04912868059012Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 137.80611416638135 195.55112071246265C 137.80611416638135 195.55112071246265 154.58699066040523 183.5989294774029 154.58699066040523 183.5989294774029C 154.58699066040523 183.5989294774029 163.28818587952873 189.65470636983312 163.28818587952873 189.65470636983312C 163.28818587952873 189.65470636983312 143.19256834964827 197.46347131007218 143.19256834964827 197.46347131007218C 143.19256834964827 197.46347131007218 137.80611416638135 195.71048326226344 137.80611416638135 195.71048326226344Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 134.6985444452658 197.62283385987297L 141.32802651697892 199.21645935788098A 10.35856573705179,7.968127490039839 0 0,0 141.32802651697892,210.37183784393676L 134.49137313052472 211.64673824234305L 124.9614926524371 205.27223625031118L 134.6985444452658 197.62283385987297Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 123.71846476399088 205.90968644951442A 29.003984063745012,27.888446215139435 0 0,0 155.2085046046283,213.71845138975343L 156.86587512255662 216.42761473636696A 20.71713147410358,23.90438247011952 0 0,1 136.77025759267616,220.73040358098854L 139.04914205482754 217.86187768457418L 128.48340500303473 215.47143943756222L 121.64675161658053 207.5033119475224L 123.71846476399088 205.90968644951442Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 119.36786715442915 208.77821234592878C 119.36786715442915 208.77821234592878 125.99734922614226 215.630801987363 125.99734922614226 215.630801987363C 125.99734922614226 215.630801987363 123.51129344924985 218.18060278417576 123.51129344924985 218.18060278417576C 123.51129344924985 218.18060278417576 132.41965998311437 222.96147927819968 132.41965998311437 222.96147927819968C 132.41965998311437 222.96147927819968 129.72643289148093 225.51128007501245 129.72643289148093 225.51128007501245C 129.72643289148093 225.51128007501245 109.63081536160043 216.26825218656623 109.63081536160043 216.26825218656623C 109.63081536160043 216.26825218656623 119.16069583968812 208.61884979612796 119.16069583968812 208.61884979612796Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 135.11288707474785 222.96147927819968C 135.11288707474785 222.96147927819968 141.32802651697892 224.07701712680523 141.32802651697892 224.07701712680523C 141.32802651697892 224.07701712680523 140.9136838874969 228.85789362082912 140.9136838874969 228.85789362082912C 140.9136838874969 228.85789362082912 128.89774763251677 229.49534382003236 128.89774763251677 229.49534382003236C 128.89774763251677 229.49534382003236 135.11288707474785 223.1208418280005 135.11288707474785 223.1208418280005Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 166.39575560064426 192.84195736584905C 166.39575560064426 192.84195736584905 169.9176679512419 195.3917581626618 169.9176679512419 195.3917581626618C 169.9176679512419 195.3917581626618 157.9017316962618 210.2124752941359 157.9017316962618 210.2124752941359C 157.9017316962618 210.2124752941359 146.3001380707638 207.66267449732314 146.3001380707638 207.66267449732314C 146.3001380707638 207.66267449732314 150.2363930508435 197.94155895947458 150.2363930508435 197.94155895947458C 150.2363930508435 197.94155895947458 166.39575560064426 192.84195736584905 166.39575560064426 192.84195736584905Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 173.02523767235743 198.73837170847858C 173.02523767235743 198.73837170847858 176.96149265243707 202.4037103538969 176.96149265243707 202.4037103538969C 176.96149265243707 202.4037103538969 159.5591022141901 216.10888963676538 159.5591022141901 216.10888963676538C 159.5591022141901 216.10888963676538 158.31607432574384 213.71845138975343 158.31607432574384 213.71845138975343C 158.31607432574384 213.71845138975343 172.81806635761635 198.73837170847858 172.81806635761635 198.73837170847858Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#b2d8ad\" stroke=\"#d87146\" d=\"M 180.2762336882937 203.83797330210405L 188.97742890741716 206.7064991985184L 149.40770779187935 229.33598127023154L 143.6069109791303 229.1766187204307L 144.22842492335343 224.55510477620763A 20.71713147410358,15.936254980079678 0 0,0 157.69456038152077,220.57104103118772A 82.86852589641433,63.74501992031871 0 0,0 180.2762336882937,203.83797330210405Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffffff\" stroke=\"#d87146\" d=\"M 166.3612201424769 127.87515258497257L 173.95750858869206 137.0384991985184L 168.95086157673987 141.81937569254228L 158.59229583968806 133.71845138975345Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffffff\" stroke=\"#d87146\" d=\"M 121.64675161658053 118.84461872043077L 132.0053173536323 111.80610079214391L 146.33467352893115 123.09427609094867L 134.94025121817418 131.19521632999252Z\" stroke-linejoin=\"miter\" \/><path stroke-width=\"1\" fill=\"#ffffff\" stroke=\"#d87146\" d=\"M 152.377156397457 136.6400928240164L 161.181937273951 143.28020437780125L 154.79416197514627 148.32669043357816L 146.5073093855048 140.75696931804032Z\" stroke-linejoin=\"miter\" \/><rect x=\"50.17264803092318\" y=\"30.132794019235554\" width=\"258.96414342629475\" height=\"199.20318725099597\" stroke-width=\"1.5936254980079678\" fill=\"none\" stroke=\"#000000\" stroke-linejoin=\"miter\" \/><\/g>",
		  "webui_profile_pic": "<g><rect x=\"194.833\" y=\"80.5\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-miterlimit=\"10\" width=\"144.167\" height=\"127\" \/><ellipse fill=\"#D1D3D4\" cx=\"262.5\" cy=\"131.182\" rx=\"23\" ry=\"21.5\" stroke=\"none\" \/><path fill=\"#D1D3D4\" stroke=\"none\" d=\"M194.833,209.5c0,0,13.114-48.136,52.883-48.136c6.498-0.453,6.639-9.612,1.094-12.066h24.171  c0,0-5.739,9.43,2.559,12.066C283.839,164,318.986,158.5,339,207.5\" \/><\/g>",
		  "webui_slider": "<g><path fill=\"#000\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M383.332,99.318c0,1.567-3.474,2.837-7.758,2.837H188.757  c-4.285,0-7.757-1.271-7.757-2.837v-0.946c0-1.567,3.473-2.837,7.757-2.837h186.817c4.284,0,7.758,1.271,7.758,2.837V99.318z\" \/><ellipse fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" cx=\"241.335\" cy=\"98.719\" rx=\"13.335\" ry=\"12.875\" \/><\/g>",
		  "webui_radio_button": "<g><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M83.234,45.684c-14.148,1.429-1.886,26.209,8.832,12.834   c11.944-14.906-18.742-18.758-12.832-6.834\" \/><ellipse fill=\"#000000\" stroke=\"#000000\" stroke-miterlimit=\"10\" cx=\"85.621\" cy=\"53.273\" rx=\"4.474\" ry=\"4.857\" \/><text transform=\"matrix(1 0 0 1 99.9009 57.5557)\" font-family=\"\'MyriadPro-Regular\'\" font-size=\"12\" templated=\"0\">Radio Button<\/text><rect x=\"60.374\" y=\"35.97\" stroke=\"none\" fill=\"none\" width=\"123.333\" height=\"40.667\" \/><\/g>",
		  "webui_checkbox": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<g><rect x=\"62.473\" y=\"37.5\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"14.526\" height=\"13.669\" \/><path fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M65.329,41.129c1.778,2.059,3.223,5.07,4.743,7.149   c2.157-5.544,6.571-12.603,8.927-15.278\" \/><text transform=\"matrix(1 0 0 1 81.9995 48.2788)\" font-family=\"\'MyriadPro-Regular\'\" font-size=\"12\" templated=\"0\">Check Box<\/text><rect x=\"46.333\" y=\"23\" stroke=\"none\" fill=\"none\" width=\"100\" height=\"42\" \/><\/g>",
		  "triangle": "<g><path stroke=\"#000000\" fill=\"#ffffff\" pointer-events=\"all\" stroke-width=\"1\" stroke-linejoin=\"round\" d=\"M 89.99999999999999 89.99999999999999 L 149.99999999999997 129.99999999999997 L 89.99999999999999 169.99999999999997 Z\" style=\"cursor: move;\" \/><\/g>",
		  "webui_scrollbar": "<g><rect x=\"145.5\" y=\"85.5\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-miterlimit=\"10\" width=\"247.5\" height=\"13.5\" \/><rect x=\"145.5\" y=\"85.5\" fill=\"#D1D3D4\" stroke=\"#000000\" stroke-miterlimit=\"10\" width=\"17.5\" height=\"13.5\" \/><polygon fill=\"#000\" stroke=\"#000000\" stroke-miterlimit=\"10\" points=\"151.75,92.75 155.75,88.25 155.75,96.25 \" \/><rect x=\"375.5\" y=\"85.5\" fill=\"#D1D3D4\" stroke=\"#000000\" stroke-miterlimit=\"10\" width=\"17.5\" height=\"13.5\" \/><polygon fill=\"#000\" stroke=\"#000000\" stroke-miterlimit=\"10\" points=\"386.25,91.75 382.25,96.25 382.25,88.25 \" \/><path fill=\"#58595B\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M278.75,92.25c0,3.176-2.574,5.75-5.75,5.75h-46  c-3.176,0-5.75-2.574-5.75-5.75l0,0c0-3.176,2.574-5.75,5.75-5.75h46C276.176,86.5,278.75,89.074,278.75,92.25L278.75,92.25z\" \/><\/g>",
		  "webui_alertbox": "<g><path fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M369.455,223.33c0,5.462-4.395,9.889-9.816,9.889  h-248.68c-5.421,0-9.816-4.427-9.816-9.889V98.889c0-5.462,4.395-9.889,9.816-9.889h248.68c5.422,0,9.816,4.427,9.816,9.889V223.33z  \" \/><text transform=\"matrix(0.9858 0 0 1 209.3716 121.8018)\" font-family=\"\'ComicSansMS\'\" font-size=\"21\" templated=\"0\">Alert<\/text><text transform=\"matrix(0.9926 0 0 1 185.2241 143.9746)\" font-family=\"\'ComicSansMS\'\" font-size=\"12\" templated=\"1\">Alert text goes here<\/text><path fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M224.145,215.088  c0,5.462-4.822,9.889-10.769,9.889H120.04c-5.948,0-10.77-4.427-10.77-9.889v-24.723c0-5.462,4.822-9.889,10.77-9.889h93.335  c5.947,0,10.769,4.427,10.769,9.889V215.088z\" \/><path fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M361.86,215.088  c0,5.462-4.935,9.889-11.021,9.889H255.32c-6.087,0-11.021-4.427-11.021-9.889v-24.723c0-5.462,4.935-9.889,11.021-9.889h95.519  c6.087,0,11.021,4.427,11.021,9.889V215.088z\" \/><text transform=\"matrix(1 0 0 1 157.4482 209)\" font-family=\"\'ComicSansMS\'\" font-size=\"14\" templated=\"2\">No<\/text><text transform=\"matrix(1 0 0 1 290.9512 209)\" font-family=\"\'ComicSansMS\'\" font-size=\"14\" templated=\"2\">Yes<\/text><\/g>",
		  "webui_curved_line": "<g><g><path fill=\"#000000\" d=\"M326,259c1.914-7.505,3.027-15.17,3.106-22.834c0.423-7.643-0.143-15.334-1.571-22.857   c-2.865-15.065-9.236-29.381-17.988-41.974c-8.754-12.615-19.863-23.555-32.401-32.424c-6.273-4.434-12.903-8.365-19.803-11.749   c-6.751-3.693-13.836-6.789-21.094-9.494c7.504,1.932,14.839,4.566,21.976,7.698c6.992,3.43,13.714,7.415,20.076,11.912   c12.715,8.995,23.991,20.095,32.889,32.917c8.894,12.798,15.386,27.37,18.31,42.74c1.465,7.675,2.021,15.528,1.619,23.339   C330.373,244.06,328.718,251.741,326,259z\" \/><\/g><text transform=\"matrix(1 0 0 1 306 152)\" font-family=\"\'ComicSansMS\'\" font-size=\"14\" templated=\"0\">Text<\/text><\/g>",
		  "webui_browser": "<g><rect x=\"68\" y=\"50\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"477\" height=\"333\" \/><rect x=\"68\" y=\"50\" fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"477\" height=\"72\" \/><path fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M92.573,84.22  c0.026-0.51,0.578-1.726,0.082-1.246c-5.298,4.665-11.85,9.676-15.18,15.944c5.388,3.091,10.77,9.182,16.314,11.216  c0.186-3.069,0.113-6.233,0.121-9.345c2.36,2.545,15.868,0.299,21.228-0.003c-0.341-6.892,0.895-9.675-5.884-10.417  c-4.682-0.513-12.405,0.867-16.729,2.269C92.051,89.974,91.321,86.409,92.573,84.22\" \/><path fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M145.46,108.774  c-0.022,0.51-0.564,1.73-0.073,1.247c5.266-4.702,11.783-9.759,15.068-16.05c-5.409-3.053-10.835-9.106-16.393-11.102  c-0.164,3.07-0.07,6.234-0.056,9.346c-2.378-2.529-15.87-0.188-21.228,0.152c0.39,6.889-0.826,9.682,5.956,10.376  c4.685,0.48,12.398-0.954,16.714-2.386C145.943,103.017,146.698,106.577,145.46,108.774\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"171.625\" y1=\"84.666\" x2=\"190.292\" y2=\"109.132\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"170.292\" y1=\"110.132\" x2=\"191.625\" y2=\"85.666\" \/><rect x=\"206.335\" y=\"84.264\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"269.665\" height=\"27.271\" \/><g><ellipse fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" cx=\"511.938\" cy=\"96.5\" rx=\"22\" ry=\"13.667\" \/><ellipse fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" cx=\"497.215\" cy=\"96.5\" rx=\"4.277\" ry=\"4.78\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"499.443\" y1=\"99.227\" x2=\"505.541\" y2=\"105.333\" \/><\/g><text transform=\"matrix(1 0 0 1 264.1826 70)\" font-family=\"\'MyriadPro-Regular\'\" font-size=\"18\" templated=\"0\">Web Page<\/text><text transform=\"matrix(1 0 0 1 211.6074 104.333)\" font-family=\"\'ComicSansMS\'\" font-size=\"18\" templated=\"1\">http:\/\/<\/text><\/g>",
		  "webui_calendar": "<g pointer-events=\"all\"><path fill=\"#F2F2F2\" stroke=\"#000000\" d=\"M78.425,47.945h150.429c2.643,0,4.786,2.143,4.786,4.786V218.16   c0,2.643-2.144,4.786-4.786,4.786H78.425c-2.643,0-4.785-2.143-4.785-4.786V52.731C73.64,50.088,75.782,47.945,78.425,47.945z\" \/><rect x=\"83.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"94.945\" fill=\"#D1D3D4\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"94.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"114.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"114.945\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"134.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"194.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"194.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"174.945\" fill=\"#FFFFFF\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"174.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"174.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"174.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"174.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"83.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"103.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"123.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"143.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"183.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"203.64\" y=\"194.945\" fill=\"#D9D9D9\" stroke=\"#909090\" width=\"20\" height=\"20\" \/><rect x=\"163.64\" y=\"154.945\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-linejoin=\"round\" width=\"20\" height=\"20\" \/><path fill=\"none\" stroke=\"#000000\" d=\"M85.204,55.945h15.87c1.969,0,3.565,1.596,3.565,3.565V70.38   c0,1.969-1.597,3.565-3.565,3.565h-15.87c-1.969,0-3.564-1.596-3.564-3.565V59.511C81.64,57.542,83.236,55.945,85.204,55.945z\" \/><path fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M96.64,60.945l-7,4l7,4\" \/><path fill=\"none\" stroke=\"#000000\" d=\"M207.204,55.945h15.87c1.969,0,3.565,1.596,3.565,3.565V70.38   c0,1.969-1.597,3.565-3.565,3.565h-15.87c-1.969,0-3.564-1.596-3.564-3.565V59.511C203.64,57.542,205.236,55.945,207.204,55.945z\" \/><path fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M211.64,60.945l7,4l-7,4\" \/><text transform=\"matrix(1 0 0 1 122.1155 70.1953)\" font-family=\"\'Arial-BoldMT\'\" font-size=\"14\">July 2012<\/text><text transform=\"matrix(1 0 0 1 86.5237 91.6953)\" font-family=\"\'ArialMT\'\" font-size=\"10\">Su<\/text><text transform=\"matrix(1 0 0 1 105.6936 91.6953)\" font-family=\"\'ArialMT\'\" font-size=\"10\">Mo<\/text><text transform=\"matrix(1 0 0 1 126.99 91.6953)\" font-family=\"\'ArialMT\'\" font-size=\"10\">Tu<\/text><text transform=\"matrix(1 0 0 1 145.2297 91.6953)\" font-family=\"\'ArialMT\'\" font-size=\"10\">We<\/text><text transform=\"matrix(1 0 0 1 166.8044 91.6953)\" font-family=\"\'ArialMT\'\" font-size=\"10\">Th<\/text><text transform=\"matrix(1 0 0 1 187.9202 91.6953)\" font-family=\"\'ArialMT\'\" font-size=\"10\">Fr<\/text><text transform=\"matrix(1 0 0 1 206.5237 91.6953)\" font-family=\"\'ArialMT\'\" font-size=\"10\">Sa<\/text><text transform=\"matrix(1 0 0 1 90.8586 108.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">1<\/text><text transform=\"matrix(1 0 0 1 110.8586 108.6953)\" font-family=\"\'ArialMT\'\" font-size=\"10\">2<\/text><text transform=\"matrix(1 0 0 1 130.8586 108.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">3<\/text><text transform=\"matrix(1 0 0 1 150.8586 108.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">4<\/text><text transform=\"matrix(1 0 0 1 170.8586 108.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">5<\/text><text transform=\"matrix(1 0 0 1 190.8586 108.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">6<\/text><text transform=\"matrix(1 0 0 1 210.8586 108.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">7<\/text><text transform=\"matrix(1 0 0 1 90.8586 128.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">8<\/text><text transform=\"matrix(1 0 0 1 110.8586 128.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">9<\/text><text transform=\"matrix(1 0 0 1 128.0779 128.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">10<\/text><text transform=\"matrix(1 0 0 1 148.449 128.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">11<\/text><text transform=\"matrix(1 0 0 1 168.0779 128.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">12<\/text><text transform=\"matrix(1 0 0 1 188.0779 128.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">13<\/text><text transform=\"matrix(1 0 0 1 208.0779 128.6953)\" fill=\"#FFFFFF\" font-family=\"\'ArialMT\'\" font-size=\"10\">14<\/text><text transform=\"matrix(1 0 0 1 88.0779 148.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">15<\/text><text transform=\"matrix(1 0 0 1 108.0779 148.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">16<\/text><text transform=\"matrix(1 0 0 1 128.0779 148.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">17<\/text><text transform=\"matrix(1 0 0 1 148.0779 148.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">18<\/text><text transform=\"matrix(1 0 0 1 168.0779 148.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">19<\/text><text transform=\"matrix(1 0 0 1 188.0779 148.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">20<\/text><text transform=\"matrix(1 0 0 1 208.0779 148.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">21<\/text><text transform=\"matrix(1 0 0 1 88.0779 168.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">22<\/text><text transform=\"matrix(1 0 0 1 108.0779 168.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">23<\/text><text transform=\"matrix(1 0 0 1 128.0779 168.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">24<\/text><text transform=\"matrix(1 0 0 1 148.0779 168.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">25<\/text><text transform=\"matrix(1 0 0 1 168.0779 168.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">26<\/text><text transform=\"matrix(1 0 0 1 188.0779 168.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">27<\/text><text transform=\"matrix(1 0 0 1 208.0779 168.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">28<\/text><text transform=\"matrix(1 0 0 1 88.0779 188.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">29<\/text><text transform=\"matrix(1 0 0 1 108.0779 188.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">30<\/text><text transform=\"matrix(1 0 0 1 128.0779 188.6953)\" fill=\"#130D8E\" font-family=\"\'ArialMT\'\" font-size=\"10\">31<\/text><text transform=\"matrix(1 0 0 1 150.8586 188.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">1<\/text><text transform=\"matrix(1 0 0 1 170.8586 188.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">2<\/text><text transform=\"matrix(1 0 0 1 190.8586 188.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">3<\/text><text transform=\"matrix(1 0 0 1 210.8586 188.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">4<\/text><text transform=\"matrix(1 0 0 1 90.8586 208.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">5<\/text><text transform=\"matrix(1 0 0 1 110.8586 208.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">6<\/text><text transform=\"matrix(1 0 0 1 130.8586 208.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">7<\/text><text transform=\"matrix(1 0 0 1 150.8586 208.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">8<\/text><text transform=\"matrix(1 0 0 1 170.8586 208.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">9<\/text><text transform=\"matrix(1 0 0 1 188.0779 208.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">10<\/text><text transform=\"matrix(1 0 0 1 208.449 208.6953)\" fill=\"#909090\" font-family=\"\'ArialMT\'\" font-size=\"10\">11<\/text><\/g>",
		  "webui_barchart": "<g><line fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" x1=\"110\" y1=\"87\" x2=\"110\" y2=\"300\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" x1=\"109\" y1=\"300\" x2=\"368\" y2=\"300\" \/><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M111,136c-3.824,8.619,2.528,21.411-1,31\" \/><rect x=\"111\" y=\"124\" fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"151\" height=\"27.5\" \/><rect x=\"111.111\" y=\"156\" fill=\"#848789\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"175.889\" height=\"28\" \/><rect x=\"111\" y=\"215\" fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"244\" height=\"27.5\" \/><rect x=\"111.111\" y=\"247\" fill=\"#848789\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"214.889\" height=\"28\" \/><\/g>",
		  "webui_columnchart": "<g><line fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" x1=\"101\" y1=\"72\" x2=\"101\" y2=\"285\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" x1=\"100\" y1=\"285\" x2=\"359\" y2=\"285\" \/><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M102,121c-3.824,8.619,2.528,21.411-1,31\" \/><rect x=\"124\" y=\"203\" fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"26\" height=\"82\" \/><rect x=\"155\" y=\"171\" fill=\"#848789\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"26\" height=\"114\" \/><rect x=\"225\" y=\"125\" fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"26\" height=\"160\" \/><rect x=\"256\" y=\"144\" fill=\"#848789\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"26\" height=\"141\" \/><\/g>",
		  "webui_linechart": "<g><line fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" x1=\"108.5\" y1=\"73\" x2=\"108.5\" y2=\"286\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" x1=\"107.5\" y1=\"286\" x2=\"366.5\" y2=\"286\" \/><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M109.5,122c-3.824,8.619,2.528,21.411-1,31\" \/><line fill=\"none\" stroke=\"#D1D3D4\" stroke-width=\"6\" stroke-miterlimit=\"10\" x1=\"127.637\" y1=\"190.5\" x2=\"184.078\" y2=\"242.5\" \/><line fill=\"none\" stroke=\"#D1D3D4\" stroke-width=\"6\" stroke-miterlimit=\"10\" x1=\"181.078\" y1=\"242.5\" x2=\"224.078\" y2=\"182.5\" \/><line fill=\"none\" stroke=\"#D1D3D4\" stroke-width=\"6\" stroke-miterlimit=\"10\" x1=\"223.078\" y1=\"183.5\" x2=\"298.078\" y2=\"170.5\" \/><line fill=\"none\" stroke=\"#D1D3D4\" stroke-width=\"6\" stroke-miterlimit=\"10\" x1=\"297.078\" y1=\"171.5\" x2=\"336.078\" y2=\"117.5\" \/><line fill=\"none\" stroke=\"#838789\" stroke-width=\"6\" stroke-miterlimit=\"10\" x1=\"135\" y1=\"264\" x2=\"200.5\" y2=\"151\" \/><line fill=\"none\" stroke=\"#838789\" stroke-width=\"6\" stroke-miterlimit=\"10\" x1=\"198.5\" y1=\"150\" x2=\"247\" y2=\"193\" \/><line fill=\"none\" stroke=\"#838789\" stroke-width=\"6\" stroke-miterlimit=\"10\" x1=\"246\" y1=\"193\" x2=\"319\" y2=\"199.5\" \/><line fill=\"none\" stroke=\"#838789\" stroke-width=\"6\" stroke-miterlimit=\"10\" x1=\"317\" y1=\"201.5\" x2=\"343\" y2=\"159.5\" \/><\/g>",
		  "webui_piechart": "<g><g><path fill=\"#DFDFDF\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" d=\"M233.251,185.999l65.264,47.418      c-26.188,36.044-76.637,44.035-112.681,17.847c-36.046-26.188-44.035-76.638-17.848-112.682      c15.713-21.628,38.532-33.255,65.265-33.255V185.999z\" \/><\/g><g><path fill=\"#000000\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" d=\"M233.251,185.999v-80.672      c44.554,0,80.672,36.118,80.672,80.672c0,17.82-4.934,32.998-15.408,47.418L233.251,185.999z\" \/><\/g><\/g>",
		  "webui_carousel": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<g><rect x=\"213\" y=\"113.332\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" width=\"118.667\" height=\"106\" \/><g><g><path fill=\"#000000\" d=\"M332.78,120.025c-0.229,0.229-0.491,0.458-0.639,0.752c-0.125,0.25-0.107,0.54-0.107,0.813    c-0.001,0.459,1.931,0.137,1.932-0.518c0.001-0.54,0.209-0.722,0.588-1.101c0.33-0.331-0.282-0.447-0.489-0.441    C333.61,119.544,333.106,119.699,332.78,120.025L332.78,120.025z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M332.529,124.497c16.923-9.042,31.262-22.456,44.76-35.909c1.724-1.718-2.003-2.416-3.244-1.179    c-13.018,12.974-26.917,26.035-43.24,34.757C328.484,123.406,330.574,125.542,332.529,124.497L332.529,124.497z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M376.795,87.248c-0.223-0.222-0.444-0.444-0.667-0.667c-0.941-0.94-4.594,0.497-3.592,1.498    c0.223,0.222,0.444,0.444,0.667,0.667C374.145,89.686,377.797,88.249,376.795,87.248L376.795,87.248z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M372.372,88.799c0.062,48.046,4.604,95.955,4.667,144c0.002,2.077,3.923,1.528,3.92-0.271    c-0.062-48.045-4.604-95.954-4.667-144C376.29,86.451,372.369,87,372.372,88.799L372.372,88.799z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M329.845,214.484c8.633,1.903,16.977,5.24,25.054,8.772c7.408,3.24,15.523,6.801,21.65,12.203    c1.138,1.003,4.773-0.527,3.566-1.591c-6.351-5.599-14.525-9.219-22.183-12.631c-8.274-3.687-16.913-7.106-25.779-9.061    C330.749,211.866,327.574,213.984,329.845,214.484L329.845,214.484z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M376.188,107.635c-1.128-0.211,2.801-2,3.485-2.333c1.3-0.632,2.775-1.199,3.913-2.109    c3.062-2.45,7.092-4.256,10.494-6.209c4.206-2.415,8.556-4.535,13.17-6.049c2.249-0.737,1.793-2.628-0.502-1.875    c-10.155,3.331-18.364,9.663-27.816,14.335c-1.58,0.782-11.23,5.158-5.121,6.298C375.004,109.916,378.367,108.042,376.188,107.635    L376.188,107.635z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M405.065,91.565c-3.226,26.797-1.513,53.92,0.991,80.703c1.254,13.417,2.293,26.828,2.353,40.308    c0.023,5.507,0.491,10.965,0.676,16.459c0.058,1.717,0.345,3.444,0.537,5.15c0.104,0.932,0.191,1.864,0.269,2.797    c0.141,1.707-0.656,1.861,1.369,1.288c0.686,0.077,1.372,0.153,2.059,0.23c-0.235-0.144-0.41-0.344-0.527-0.6    c-0.769-1.095-4.509,0.208-3.584,1.526c0.976,1.391,3.661,1.227,4.401-0.404c1.14-2.512-0.259-6.978-0.539-9.596    c-1.499-14.049-0.664-28.263-1.843-42.355c-2.668-31.911-6.143-64.005-2.294-95.977C409.123,89.514,405.227,90.225,405.065,91.565    L405.065,91.565z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M382.373,223.406c-1.251-0.093-4.065,0.176-3.728,2.057c0.314,1.748,4.901,3.306,6.177,3.942    c3.405,1.7,6.883,3.255,10.341,4.842c4.377,2.008,8.626,4.533,13.354,5.598c1.451,0.327,4.581-1.849,2.295-2.363    c-5.845-1.315-11.489-4.76-16.962-7.283c-2.285-1.053-4.559-2.13-6.81-3.254c-0.945-0.473-1.878-0.97-2.802-1.484    c-0.355-0.2-0.705-0.409-1.049-0.628c-2.128-1.316,1.978,1.401-2.233,1.087C382.647,226.047,384.993,223.602,382.373,223.406    L382.373,223.406z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M402.751,104.768c4.381,1.25,10.483-4.428,13.538-6.669c6.425-4.714,12.423-9.996,18.863-14.681    c1.604-1.166-2.269-0.69-2.975-0.177c-4.381,3.186-8.524,6.715-12.789,10.051c-2.543,1.989-5.114,3.942-7.729,5.835    c-1.232,0.893-2.489,1.75-3.764,2.583c-0.864,0.564-3.067,1.206-1.983,1.515C404.994,102.963,401.562,104.428,402.751,104.768    L402.751,104.768z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M430.4,83.181c-0.675,29.176,3.787,57.95,4.451,87.034c0.526,23.024-3.734,49.571,6.882,70.966    c0.437,0.881,4.127-0.504,3.863-1.035c-10.364-20.889-6.6-47.004-6.856-69.516c-0.157-13.772-1.863-27.534-2.885-41.26    c-1.17-15.714-1.956-31.464-1.592-47.224C434.275,81.652,430.425,82.132,430.4,83.181L430.4,83.181z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M408.787,228.236c10.689,4.277,21.654,8.266,32,13.333c1.076,0.527,4.638-1.055,3.09-1.812    c-10.345-5.067-21.31-9.056-32-13.333C410.77,225.981,407.238,227.616,408.787,228.236L408.787,228.236z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M210.08,210.325c-17.06,8.78-31.597,21.983-45.299,35.226c-1.745,1.686,1.989,2.392,3.244,1.179    c13.218-12.773,27.324-25.604,43.781-34.073C214.148,211.45,212.045,209.314,210.08,210.325L210.08,210.325z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M165.274,246.901c0.219,0.226,0.438,0.451,0.656,0.677c0.924,0.953,4.587-0.472,3.592-1.498    c-0.219-0.226-0.438-0.451-0.656-0.677C167.942,244.451,164.279,245.875,165.274,246.901L165.274,246.901z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M169.708,245.36c0.68-48.041-3.123-96.014-2.443-144.055c0.029-2.075-3.896-1.531-3.921,0.271    c-0.679,48.041,3.123,96.014,2.443,144.055C165.758,247.706,169.683,247.162,169.708,245.36L169.708,245.36z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M214.155,120.359c-8.608-2.038-16.887-5.505-24.913-9.164c-7.361-3.355-15.411-7.042-21.457-12.54    c-1.123-1.021-4.767,0.5-3.566,1.591c6.261,5.695,14.388,9.44,21.988,12.968c8.211,3.812,16.809,7.363,25.638,9.453    C213.251,123,216.424,120.896,214.155,120.359L214.155,120.359z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M166.201,226.517c1.05,0.213-2.765,1.906-3.548,2.272c-1.311,0.612-2.785,1.167-3.938,2.061    c-3.097,2.401-7.163,4.142-10.592,6.041c-4.245,2.352-8.63,4.388-13.268,5.831c-2.268,0.705-1.799,2.591,0.503,1.875    c10.2-3.172,18.513-9.388,28.031-13.912c1.584-0.752,11.299-4.986,5.19-6.225C167.383,224.217,164.021,226.075,166.201,226.517    L166.201,226.517z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M137.059,242.09c3.639-26.744,2.34-53.892,0.25-80.708c-1.047-13.435-1.874-26.86-1.725-40.339    c0.061-5.505-0.326-10.972-0.426-16.468c-0.031-1.718-0.292-3.449-0.458-5.158c-0.09-0.933-0.163-1.866-0.225-2.801    c-0.116-1.73,0.692-1.822-1.327-1.284c-0.686-0.076-1.372-0.153-2.058-0.229c0.232,0.147,0.405,0.35,0.518,0.608    c0.748,1.102,4.493-0.188,3.584-1.526c-0.966-1.422-3.636-1.216-4.396,0.392c-1.175,2.487,0.161,6.992,0.399,9.606    c1.282,14.068,0.229,28.27,1.189,42.378c2.175,31.949,5.149,64.093,0.808,96.001C132.979,244.129,136.876,243.433,137.059,242.09    L137.059,242.09z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M161.807,110.656c1.271,0.114,4.04-0.157,3.731-2.04c-0.285-1.74-4.868-3.38-6.124-4.031    c-7.266-3.768-15.627-8.891-23.533-10.799c-1.452-0.351-4.58,1.812-2.295,2.363c5.827,1.406,11.414,4.943,16.845,7.549    c2.268,1.088,4.524,2.201,6.758,3.359c0.939,0.487,1.864,0.999,2.78,1.526c0.352,0.206,0.698,0.42,1.038,0.645    c2.133,1.365-2.042-1.47,2.215-1.087C161.527,107.989,159.189,110.42,161.807,110.656L161.807,110.656z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M139.569,228.93c-4.315-1.304-10.578,4.339-13.629,6.506c-6.497,4.615-12.575,9.803-19.088,14.388    c-1.616,1.137,2.264,0.678,2.976,0.177c4.429-3.118,8.626-6.582,12.943-9.852c2.573-1.95,5.174-3.863,7.818-5.716    c1.246-0.874,2.516-1.711,3.803-2.524c0.94-0.594,2.991-1.142,2.017-1.437C137.321,230.749,140.765,229.292,139.569,228.93    L139.569,228.93z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M111.593,250.082c1.125-29.162-2.892-58.001-3.107-87.092c-0.17-23.029,4.5-49.507-5.785-71.064    c-0.418-0.876-4.126,0.484-3.863,1.035c10.041,21.046,5.873,47.1,5.782,69.614c-0.055,13.772,1.438,27.56,2.248,41.299    c0.927,15.73,1.47,31.491,0.862,47.243C107.711,251.593,111.553,251.142,111.593,250.082L111.593,250.082z\" \/><\/g><\/g><g><g><path fill=\"#000000\" d=\"M135.438,105.384c-10.623-4.442-21.524-8.6-31.791-13.826c-1.068-0.544-4.634,1.026-3.09,1.812    c10.266,5.226,21.167,9.384,31.791,13.826C133.45,107.657,136.988,106.032,135.438,105.384L135.438,105.384z\" \/><\/g><\/g><\/g>",
		  "webui_table": "<g><rect x=\"45.612\" y=\"40\" fill=\"#CCCCCC\" stroke=\"#FFFFFF\" width=\"474.833\" height=\"19.937\" \/><rect x=\"45.612\" y=\"59.937\" fill=\"#FFFFFF\" width=\"474.055\" height=\"19.937\" \/><rect x=\"45.612\" y=\"79.873\" fill=\"#EDEDED\" width=\"474.055\" height=\"19.936\" \/><rect x=\"45.612\" y=\"99.809\" fill=\"#FFFFFF\" width=\"474.055\" height=\"19.937\" \/><rect x=\"45.612\" y=\"119.746\" fill=\"#EDEDED\" width=\"474.055\" height=\"19.937\" \/><rect x=\"45.612\" y=\"139.682\" fill=\"#FFFFFF\" stroke=\"#FFFFFF\" width=\"474.055\" height=\"19.936\" \/><rect x=\"45.612\" y=\"159.618\" fill=\"#EDEDED\" width=\"474.055\" height=\"19.937\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M131.237,40v139.555\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M198.181,40v139.555\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M276.022,40v139.555\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M417.694,40v139.555\" \/><rect x=\"198.181\" y=\"40\" fill=\"#CCCCCC\" width=\"77.841\" height=\"19.937\" \/><path stroke=\"#000000\" d=\"M271.201,48.07h-4.542l2.271,3.611L271.201,48.07z\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M507.99,40v19.937\" \/><rect x=\"45.612\" y=\"40\" fill=\"none\" stroke=\"#FFFFFF\" width=\"474.833\" height=\"139.555\" \/><rect x=\"507.99\" y=\"59.937\" fill=\"#FFFFFF\" stroke=\"#FFFFFF\" width=\"11.677\" height=\"119.618\" \/><path fill=\"#CCCCCC\" stroke=\"#666666\" d=\"M509.705,74.672h8.246c0.517,0,0.937,0.467,0.937,1.043v53.39   c0,0.576-0.42,1.042-0.937,1.042h-8.246c-0.519,0-0.937-0.467-0.937-1.042v-53.39C508.769,75.139,509.187,74.672,509.705,74.672z\" \/><rect x=\"507.99\" y=\"59.937\" fill=\"#FFFFFF\" stroke=\"#000000\" width=\"11.677\" height=\"13.002\" \/><path stroke=\"#000000\" d=\"M517.083,69.199h-7.006l3.503-6.068L517.083,69.199z\" \/><rect x=\"507.99\" y=\"166.553\" fill=\"#FFFFFF\" stroke=\"#000000\" width=\"11.677\" height=\"13.002\" \/><path stroke=\"#000000\" d=\"M517.083,169.747h-7.006l3.503,6.068L517.083,169.747z\" \/><rect x=\"198.181\" y=\"59.937\" fill=\"#FFFFFF\" width=\"77.841\" height=\"19.937\" \/><rect x=\"198.181\" y=\"79.873\" fill=\"#EDEDED\" width=\"77.841\" height=\"19.936\" \/><rect x=\"198.181\" y=\"99.809\" fill=\"#FFFFFF\" width=\"77.841\" height=\"19.937\" \/><rect x=\"198.181\" y=\"119.746\" fill=\"#EDEDED\" width=\"77.841\" height=\"19.937\" \/><rect x=\"198.181\" y=\"139.682\" fill=\"#FFFFFF\" width=\"77.841\" height=\"19.936\" \/><rect x=\"198.181\" y=\"159.618\" fill=\"#EDEDED\" width=\"77.841\" height=\"19.937\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M45.612,79.873H507.99\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M45.612,99.809H507.99\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M45.612,119.746H507.99\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M45.612,139.682H507.99\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M45.612,159.618H507.99\" \/><path fill=\"none\" stroke=\"#FFFFFF\" d=\"M45.612,59.937H507.99\" \/><text transform=\"matrix(0.898 0 0 1 53.3958 53.4355)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"0\">Order No<\/text><text transform=\"matrix(0.898 0 0 1 139.0212 53.4355)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"0\">Customer ID<\/text><text transform=\"matrix(0.898 0 0 1 209.0784 53.4355)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"0\">Item SKU<\/text><text transform=\"matrix(0.898 0 0 1 286.9202 53.4355)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"0\">Quantity<\/text><text transform=\"matrix(0.898 0 0 1 427.0344 53.4355)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"0\">Price<\/text><text transform=\"matrix(0.898 0 0 1 53.3958 73.3716)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"1\">3789<\/text><text transform=\"matrix(0.898 0 0 1 139.0212 73.3716)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"1\">ANZ66438<\/text><text transform=\"matrix(0.898 0 0 1 209.0784 73.3716)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"1\">BIS-7890<\/text><text transform=\"matrix(0.898 0 0 1 286.9202 73.3716)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"1\">2<\/text><text transform=\"matrix(0.898 0 0 1 427.0344 73.3716)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"1\">$ 270.00<\/text><text transform=\"matrix(0.898 0 0 1 53.3958 93.3081)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"2\">3790<\/text><text transform=\"matrix(0.898 0 0 1 139.0212 93.3081)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"2\">ANZ43810<\/text><text transform=\"matrix(0.898 0 0 1 209.0784 93.3081)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"2\">Z-672619<\/text><text transform=\"matrix(0.898 0 0 1 286.9202 93.3081)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"2\">1<\/text><text transform=\"matrix(0.898 0 0 1 427.0344 93.3081)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"2\">$ 99.95<\/text><text transform=\"matrix(0.898 0 0 1 53.3958 113.2446)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"3\">3791<\/text><text transform=\"matrix(0.898 0 0 1 139.0212 113.2446)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"3\">URT62439<\/text><text transform=\"matrix(0.898 0 0 1 209.0784 113.2446)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"3\">Z-652314<\/text><text transform=\"matrix(0.898 0 0 1 286.9202 113.2446)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"3\">3<\/text><text transform=\"matrix(0.898 0 0 1 427.0344 113.2446)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"3\">$ 78.75<\/text><text transform=\"matrix(0.898 0 0 1 53.3958 133.1807)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"4\">3792<\/text><text transform=\"matrix(0.898 0 0 1 139.0212 133.1807)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"4\">ANZ10457<\/text><text transform=\"matrix(0.898 0 0 1 209.0784 133.1807)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"4\">CYU-9071<\/text><text transform=\"matrix(0.898 0 0 1 286.9202 133.1807)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"4\">1<\/text><text transform=\"matrix(0.898 0 0 1 427.0344 133.1807)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"4\">$ 1011.00<\/text><text transform=\"matrix(0.898 0 0 1 53.3958 153.1172)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"5\">3793<\/text><text transform=\"matrix(0.898 0 0 1 139.0212 153.1172)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"5\">URT65401<\/text><text transform=\"matrix(0.898 0 0 1 209.0784 153.1172)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"5\">BIS-56007<\/text><text transform=\"matrix(0.898 0 0 1 286.9202 153.1172)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"5\">1<\/text><text transform=\"matrix(0.898 0 0 1 427.0344 153.1172)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"5\">$ 30.45<\/text><text transform=\"matrix(0.898 0 0 1 53.3958 173.0537)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"6\">3794<\/text><text transform=\"matrix(0.898 0 0 1 139.0212 173.0537)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"6\">ANZ00234<\/text><text transform=\"matrix(0.898 0 0 1 209.0784 173.0537)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"6\">CYU-4501<\/text><text transform=\"matrix(0.898 0 0 1 286.9202 173.0537)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"6\">2<\/text><text transform=\"matrix(0.898 0 0 1 427.0344 173.0537)\" font-family=\"\'ArialMT\'\" font-size=\"10.4016\" templated=\"6\">$ 44.89<\/text><\/g>",
		  "webui_frame_slider": "<g><rect x=\"50.5\" y=\"30\" fill=\"none\" width=\"439\" height=\"200\" \/><path fill=\"#FFFFFF\" stroke=\"#000000\" d=\"M54.138,30h431.722c2.01,0,3.639,1.629,3.639,3.639v192.722   c0,2.009-1.629,3.639-3.639,3.639H54.138c-2.01,0-3.639-1.629-3.639-3.639V33.639C50.5,31.629,52.129,30,54.138,30z\" \/><path stroke=\"#000000\" d=\"M454.499,213v9l-7-4.5L454.499,213z\" \/><path stroke=\"#000000\" d=\"M466.499,213v9l7-4.5L466.499,213z\" \/><rect x=\"75.5\" y=\"70\" fill=\"#999999\" stroke=\"#999999\" width=\"100\" height=\"85\" \/><rect x=\"220.5\" y=\"70\" fill=\"#999999\" stroke=\"#999999\" width=\"100\" height=\"85\" \/><rect x=\"365.499\" y=\"70\" fill=\"#999999\" stroke=\"#999999\" width=\"100\" height=\"85\" \/><path fill=\"none\" stroke=\"#000000\" d=\"M50.5,205h439\" \/><ellipse fill=\"#CCCCCC\" stroke=\"#CCCCCC\" cx=\"380.499\" cy=\"217.5\" rx=\"5\" ry=\"5\" \/><ellipse fill=\"#CCCCCC\" stroke=\"#CCCCCC\" cx=\"399.499\" cy=\"217.5\" rx=\"5\" ry=\"5\" \/><ellipse fill=\"#333333\" stroke=\"#333333\" cx=\"361.499\" cy=\"217.5\" rx=\"5\" ry=\"5\" \/><ellipse fill=\"#CCCCCC\" stroke=\"#CCCCCC\" cx=\"418.499\" cy=\"217.5\" rx=\"5\" ry=\"5\" \/><path fill=\"none\" stroke=\"#999999\" stroke-width=\"2\" d=\"M442.562,210h35.875c1.139,0,2.062,0.923,2.062,2.062v10.875   c0,1.139-0.924,2.062-2.062,2.062h-35.875c-1.139,0-2.062-0.923-2.062-2.062v-10.875C440.499,210.923,441.423,210,442.562,210z\" \/><path fill=\"none\" stroke=\"#999999\" stroke-width=\"2\" d=\"M460.499,210v15\" \/><text transform=\"matrix(1 0 0 1 75.4993 56)\" font-family=\"\'ArialMT\'\" font-size=\"16\" templated=\"0\">Container Title Goes Here<\/text><text transform=\"matrix(1 0 0 1 106.5955 128.75)\" fill=\"#FFFFFF\" font-family=\"\'Arial-BoldMT\'\" font-size=\"50\">1<\/text><text transform=\"matrix(1 0 0 1 256.5955 128.75)\" fill=\"#FFFFFF\" font-family=\"\'Arial-BoldMT\'\" font-size=\"50\">2<\/text><text transform=\"matrix(1 0 0 1 401.595 128.75)\" fill=\"#FFFFFF\" font-family=\"\'Arial-BoldMT\'\" font-size=\"50\">3<\/text><text transform=\"matrix(1 0 0 1 75.4993 171.75)\" font-family=\"\'Arial-BoldMT\'\" font-size=\"10\" templated=\"1\">Item Title 1<\/text><text transform=\"matrix(1 0 0 1 220.4993 171.75)\" font-family=\"\'Arial-BoldMT\'\" font-size=\"10\" templated=\"1\">Item Title 2<\/text><text transform=\"matrix(1 0 0 1 365.4993 171.75)\" font-family=\"\'Arial-BoldMT\'\" font-size=\"10\" templated=\"1\">Item Title 3<\/text><text transform=\"matrix(1 0 0 1 75.4993 188.75)\" font-family=\"\'ArialMT\'\" font-size=\"10\" templated=\"2\">Subtitle 1<\/text><text transform=\"matrix(1 0 0 1 220.4993 188.75)\" font-family=\"\'ArialMT\'\" font-size=\"10\" templated=\"2\">Subtitle 2<\/text><text transform=\"matrix(1 0 0 1 365.4993 188.75)\" font-family=\"\'ArialMT\'\" font-size=\"10\" templated=\"2\">Subtitle 3<\/text><text transform=\"matrix(1 0 0 1 60.4993 220.875)\" font-family=\"\'Arial-BoldMT\'\" font-size=\"9\">&gt;&gt; View All<\/text><\/g>",
		  "webui_formatting_toolbar": "<g><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"68\" y1=\"100\" x2=\"459\" y2=\"97\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"68\" y1=\"100\" x2=\"68\" y2=\"137.333\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"68\" y1=\"137.333\" x2=\"459\" y2=\"132.667\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"459\" y1=\"97\" x2=\"459\" y2=\"132.667\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"99.145\" y1=\"109\" x2=\"114.73\" y2=\"109\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"108.125\" y1=\"109\" x2=\"101.875\" y2=\"130.295\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"94\" y1=\"130.295\" x2=\"110\" y2=\"130.295\" \/><path fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" d=\"M123,110c-1.743-1.303-2.047,14.692,2.758,16.242  c7.106,2.292,6.794-12.097,6.242-17.242\" \/><line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"117\" y1=\"130.667\" x2=\"141\" y2=\"130.667\" \/><path fill=\"none\" stroke=\"#000000\" stroke-width=\"4\" stroke-miterlimit=\"10\" d=\"M76,108c0.002,4.357-2.85,16.793-1.023,20.023  c3.206,5.669,12.35,3.253,12.872-3.849c-3.082-2.128-6.98-3.673-10.991-3.174c-0.74,0-0.74,0,0,0  c13.391,2.08,12.188-14.015-0.857-11\" \/><path fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M161.431,118.927c-5.47-8.582-15.884,6.293-8,11.096  c5.219-3.312,7.933-10.562,7-16.842c-0.753,5.732,0.197,14.512,7,10.746\" \/><path fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M172.431,108.927  c-0.016-0.016-1.368-2.576-0.968-1.298c-2.357,6.809,1.604,12.561,0.964,19.444c-0.988-1.558-1.356-12.078,5.026-8.169  c6.269,3.838-1.137,10.332-5.023,7.023\" \/><path fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M194.431,115.927  c-6.698-6.155-11.373,3.768-9.849,9.849c3.351,0.6,7.509,0.236,9.849-0.849\" \/><path fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M143.431,124.927c19.989,0.569,39.132-5,59-5\" \/><g><g><path fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M210.368,105.479    c24.812,3.083,50.76-2.4,75.869-0.826c-2.03,7.22-0.617,16.737-1.02,24.674c-25.854,1.311-51.718,2.724-77.713,1    c-0.343-7.55-0.135-15.249-0.135-22.849\" \/><line fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" x1=\"265.884\" y1=\"104.375\" x2=\"264.715\" y2=\"130.197\" \/><path stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" d=\"M268.797,113.974c3.626,0,7.32-0.111,10.904,0.116    c-1.259,2.112-2.584,4.444-3.604,6.536c-1.537-2.524-4.108-4.183-6.083-6.078\" \/><\/g><text transform=\"matrix(1.1356 0 0 1 215.4824 121.6255)\" font-family=\"\'ComicSansMS\'\" font-size=\"16.6921\">style<\/text><\/g><g><line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"298.995\" y1=\"107.394\" x2=\"326.408\" y2=\"107.394\" \/><line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"298.995\" y1=\"116.894\" x2=\"326.408\" y2=\"116.394\" \/><line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"298.995\" y1=\"124.394\" x2=\"326.408\" y2=\"124.394\" \/><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M294.495,107.394c-0.39,0.514-0.42,1.312-1.036,1.837   c-0.345-1.546,0.535-0.808,1.036-1.337\" \/><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M293.495,116.894c0.376-1.028,0-0.783-0.012,0.341   c0.296-0.553,0.552-1.285,0.925-1.777c-0.381,0.5-0.277,0.645-0.413,1.511c0.008,0.371,0.017,0.354,0.026-0.049   c0.045-0.398-0.096-0.558-0.424-0.479c-0.209,0.288-0.219,0.582-0.029,0.881c0.293,0.185,0.582,0.178,0.866-0.018   c-0.095-0.652-0.759-0.533-0.938-0.91\" \/><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M293.995,123.894c-0.003,0.251-0.863,0.104-0.424,0.924   c0.283,0.201,0.566,0.201,0.849,0c0.201-0.283,0.201-0.566,0-0.849c-0.283-0.201-0.566-0.201-0.849,0   c-0.428,1.285,0.447,0.491,0.924,0.924\" \/><\/g><g><line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"340.484\" y1=\"107.341\" x2=\"367.897\" y2=\"107.341\" \/><line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"340.484\" y1=\"116.841\" x2=\"367.897\" y2=\"116.341\" \/><line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"340.484\" y1=\"124.341\" x2=\"367.897\" y2=\"124.341\" \/><text transform=\"matrix(1 0 0 1 331.9893 110.4468)\" font-family=\"\'ComicSansMS\'\" font-size=\"7\">1<\/text><text transform=\"matrix(1 0 0 1 331.9893 118.9468)\" font-family=\"\'ComicSansMS\'\" font-size=\"7\">2<\/text><text transform=\"matrix(1 0 0 1 331.9893 126.4468)\" font-family=\"\'ComicSansMS\'\" font-size=\"7\">3<\/text><\/g><line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"373\" y1=\"105.182\" x2=\"373\" y2=\"126.064\" \/><g><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M391.582,109.933c-4.923-10.023-25.149,9.297-5.741,10.247\" \/><path stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M384.01,114.22c-0.176,3.196-1.378,5.693-2.153,8.791   c3.544-0.541,6.806-1.857,10.271-2.814c-2.231-1.794-5.138-3.186-8.117-3.927\" \/><\/g><g><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M399.228,109.09c3.231-5.667,11.63-3.344,12.707,2.08   c1.224,6.164-5.515,8.087-10.357,10.634\" \/><path stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M402.361,118.812c-1.555-1.834-4.038,1.828-5.994,4.357   c2.875,0.152,5.91,0.095,8.854,0.166c-1.358-2.042-2.454-4.887-2.859-6.766\" \/><\/g><line fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" x1=\"417.5\" y1=\"105.182\" x2=\"417.5\" y2=\"126.064\" \/><g><rect x=\"424.321\" y=\"105.894\" fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" width=\"26.468\" height=\"19\" \/><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M438.484,119.296c0.566-2.549,1.788-5.401,2.856-7.825   c1.202,2.371,3.792,5.246,5.814,6.999\" \/><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M430.208,118.883c-0.87,0.088-1.445-0.056-2.253,0.435   c5.824-0.09,11.418-0.848,17.229-0.848\" \/><path fill=\"none\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M434.402,117.789c0.605-1.588,0.955-3.348,1.598-4.812   c0.239,1.773,1.623,3.048,2.737,4.398\" \/><\/g><\/g>",
          "webui_accordian": "<g><rect x=\"78.333\" y=\"51\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"124\" height=\"222.667\" \/><g elemental=\"true\"><rect x=\"78.333\" y=\"51\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"124\" height=\"19.334\" \/><text transform=\"matrix(0.8455 0 0 1 125.9834 65)\" font-family=\"\'MyriadPro-Regular\'\" font-size=\"12\" templated=\"0\">Item 1<\/text><\/g><\/g>",
          //"webui_tabs": "<g><rect x=\"76.999\" y=\"72\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"320.667\" height=\"224\" \/><g elemental=\"true\"><polygon fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" points=\"151,72 84.333,72 84.333,48 133.667,48    151,60  \" \/><text transform=\"matrix(1 0 0 1 95 64.334)\" font-family=\"\'MyriadPro-Regular\'\" font-size=\"12\" templated=\"0\">One<\/text><\/g><\/g>",
          "webui_tabs": "<g><rect x=\"76.999\" y=\"72\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"320.667\" height=\"224\" \/><g><polygon fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" points=\"151,72 84.333,72 84.333,48 133.667,48    151,60  \" \/><text transform=\"matrix(1 0 0 1 90 66.334)\" font-family=\"\'MyriadPro-Regular\'\" font-size=\"12\" templated=\"0\">One<\/text><\/g><g elemental=\"true\"><polygon fill=\"#D1D3D4\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" points=\"217.667,72 151,72 151,48 200.333,48    217.667,60  \" \/><text transform=\"matrix(1 0 0 1 158.6665 66.334)\" font-family=\"\'MyriadPro-Regular\'\" font-size=\"12\" templated=\"0\">Two<\/text><\/g><\/g>",
          "webui_group_box": "<g><rect x=\"70\" y=\"73.666\" fill=\"#FFFFFF\" stroke=\"#000000\" stroke-width=\"2\" stroke-miterlimit=\"10\" width=\"281.333\" height=\"186.667\" \/><g><rect x=\"78.001\" y=\"65.999\" fill=\"#FFFFFF\" stroke=\"none\" width=\"55.666\" height=\"21.333\" \/><text transform=\"matrix(1 0 0 1 83.667 79.667)\" font-size=\"12\" templated=\"0\">Group<\/text><\/g><\/g>",
          "webui_tooltip": "<g><path id=\"rect4124\" fill=\"#E6E6E5\" stroke=\"#010101\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"  M53.769,28h203.055c2.313,0,4.176,3.665,4.176,8.218v30.786c0,4.553-1.862,8.217-4.176,8.217H72.379l-3.804,13.768l-3.81-13.768  H53.769c-2.313,0-4.175-3.665-4.175-8.217V36.218C49.594,31.665,51.456,28,53.769,28z\" \/><text transform=\"matrix(1 0 0 1 58 50)\" font-size=\"12\" templated=\"0\">This is a tool tip<\/text><\/g>",
          "webui_textarea": "<g><rect x=\"78\" y=\"62\" fill=\"none\" stroke=\"none\" width=\"211\" height=\"64\" \/><text transform=\"matrix(1 0 0 1 93 86)\" font-size=\"14\" templated=\"0\">This is a text area.<\/text><\/g>",


          "sticky_note": "<g><g><rect x=\"85.64\" y=\"84\" fill=\"#F8ED3F\" width=\"212\" height=\"184\" \/><path fill=\"#000000\" d=\"M297.64,268l-53,0.543l-26.5,0.272c-8.833,0.08-17.667,0.215-26.5,0.207L85.64,269h-1v-1V84v-1h1h212h1v1v46v23    c0.025,7.667,0.032,15.333-0.071,23L297.64,268z M297.64,268l-0.929-92c-0.103-7.667-0.096-15.333-0.071-23v-23V84l1,1h-212l1-1    v184l-1-1l106-0.022c8.833-0.008,17.667,0.127,26.5,0.207l26.5,0.272L297.64,268z\" \/><\/g><path fill=\"#D32A27\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M169,75c-2.839,6.255-5.046,13.979-4.826,20.872   C176.391,92.469,192.78,92.458,206,92c14.816-0.514,12.763-7.008,21.897-16.801C207.325,73.68,187.391,76,167,76\" \/><\/g>",
		  "social_rss": "<g><ellipse fill=\"#000\" cx=\"40.486\" cy=\"59.071\" rx=\"3.391\" ry=\"3.429\" \/><path fill=\"#000\" d=\"M53.486,62.5h-4.805c0-6.47-5.188-11.715-11.587-11.715l0,0v-4.856C46.147,45.929,53.486,53.348,53.486,62.5z\" \/><path fill=\"#000\" d=\"M56.878,62.5c0-11.046-8.857-20-19.784-20v-5c13.658,0,24.73,11.193,24.73,25H56.878z\" \/><\/g>",
          "media_video_cam": "<g><path fill=\"#000000\" d=\"M91.115,32.785H55.329l4.243-7.774h35.521c2.454,0,4.443-1.989,4.443-4.443c0-2.453-1.989-4.442-4.443-4.442H56.938   c-1.627,0-3.121,0.887-3.899,2.314l-7.829,14.345H33.361c-4.906,0-8.885,3.979-8.885,8.885v7.74L6.695,38.952   C6,38.543,5.222,38.338,4.442,38.338c-0.76,0-1.521,0.195-2.205,0.585C0.854,39.716,0,41.188,0,42.781v31.098   c0,1.594,0.854,3.064,2.236,3.855c0.684,0.393,1.445,0.588,2.206,0.588c0.779,0,1.557-0.205,2.251-0.613l17.783-10.451v7.732   c0,4.906,3.979,8.885,8.885,8.885h57.754c4.906,0,8.885-3.979,8.885-8.885V41.67C100,36.764,96.021,32.785,91.115,32.785z    M91.115,72.768c0,1.224-1,2.224-2.223,2.224H55.574c-1.221,0-2.221-1-2.221-2.224v-17.77c0-1.221,1-2.221,2.221-2.221h33.318   c1.223,0,2.223,1,2.223,2.221V72.768z\" \/><\/g>",

		  "iphone_frame_4": "<g><image overflow=\"visible\" width=\"247\" height=\"488\" href=\"data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPcAAAHoCAYAAACVe3mpAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA IGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAABwDSURBVHja7N17XNX1 4cfx9+Ec4IBcVMArik4uJqKyMi0RFGk6UpxSgeZDKs2tpj\/NftWj1NV0br+mbpqWbNr6OadpeYm8 lSliwXR4K9NMxVDMKYIgIAiHy\/f3R7rxa16OBnLA1\/PxOP6h33Ph8+Hl93K+53tMAhofs6SXJYVL qrzDz22RlC1ppqSSunxgwzCYWdz1wiTlSjIa6HZZ0pC6\/qEMw6jTmxO\/J2iE+ktq1YDPb5UU7eiD ZHGA1+AkyefKZHWU1ElSO0ktJHk5OTk1M9hewb9VmkymwJqamgZ9ESaTaZikAEkmwzCKr2yi50s6 LekbSWevbF1carDX2EDP6ynpPkkPSLrf29s7qEuXLv6dO3f2at++vfz9\/eXj4yMvLy+5u7vz64zv h6XCwkKVlJTIZLqzv8KGYcjd3V0+Pj4ymUyqrq5WcXGxiouLde7cOZ05c0anT5+uOXHixPmcnJxT NpvtiKQMSbskHZFUc6f2uU13OOgHJY3w9fWN6d69e6f+\/fub77\/\/fvXo0UN+fn6yWq13fLKAulZd Xa2ysjJlZ2fr888\/V3p6unbv3l16\/PjxA+Xl5ZslbZT0laTqxh63n6QkFxeXMZGRkWHx8fFOUVFR CgwMlLOzM78JuCsUFRXp4MGD2rJli9atW1dy9OjRHZKWSPpYV474N6a4O0ka17JlyyeHDx\/efsKE Cbr\/\/vvl5MQxPNzdLl26pPXr1+vtt99WRkZGRlVV1VuSUgzDKHX0uFtI+mWrVq0mPv30062TkpIU GBjI5jbwPRUVFUpPT9fChQu1adOm3VVVVb+T9KGjvt6hVqv1q6efftrIzs42ANhn48aNxgMPPGBI Wimpc13EaK6jqL0lvR4WFjbvnXfeaT158mS1aNGC\/5oBOwUHByshIUFWqzVs37598Tab7dsrB90a NO77TSbT6qeffnrk8uXLncLCwtgEB26Di4uLoqKiNGDAAK\/9+\/ePPHfuXBtJ6ZIqGiLuES1atFiV nJwcOH36dN6TBupAhw4dlJiY6JSXl9f7wIEDfSWlSSq6k3FPDgwMXLxmzRqvoUOHMiNAHbJarYqL i1OzZs067dy5M6a6unq3pHP1HbdJ0mv33Xff\/6xZs8bSq1cvZgKoJ\/369ZO\/v3+rTz75ZFhlZeVe SafqM+5f9e7d+7W1a9eqS5cujD5Qz8LDwxUUFOS5efPmIZWVlemSztRH3BN79er1+rp160wBAQGM OnCHhIaGKiAgwHPTpk2Dqqurt0s6X5dxj+jSpcuf16xZYwkKCmK0gTvsymcwWmzZsqW3YRgfSiqt i7i7e3l5vbd27VrvH\/\/4x4wy0EDuu+8+lZeXt09PTw+QtFbfXTzituO2Slo5b9680Pj4eEYXaGD9 +vXT3r17Q0+cOFEkaff1lrPnbJNXExISXluxYoXMZjMjCziAr7\/+WgMGDCjMzc19SNK+21lz3+fv 7\/\/W3\/72N6uPjw8jCjgIX19feXp6um3cuLGjpFXX2jy\/UdxOkv40d+7cHjExMYwm4GB69uyp\/fv3 Bx4\/fvxbSftvZbP8kX79+r2\/detWTisFHFR6eroGDRr0lc1mG6jvvT12vTW3q8lkemvBggUdw8LC GEHAQXXs2FFZWVl+X3zxxVl97+Da9S6LEhsdHR3xs5\/9jNEDHNyzzz4rd3f3CZK87In7iQkTJjBq QCPQp08fxcbGdpU08mZx9+zZs+dPOIgGNB5JSUmSNKp209eKe8RPf\/pTa8uWLRkxoJGIjo5Wt27d HpTU43pxu1sslp8MHz6c0QIaEXd3d8XFxXlIeuh6cXcNCwvryfnjQOMTExMjJyenwdeLu3dkZKS7 i4sLIwU0Mt26dVOXLl3CJflfM+4+ffowSkAj1LZtW4WEhHhL6iXJs3bcTp6enmGBgYGMEtBI9ezZ 0yypmySf2nG3btWqVed27doxQkAj1bVrV12JO6B23B18fX09fH19GSGgkbpy+bMOkjrXjrtNq1at XFxdXRkhoJFq166d3NzcWkpqVzvuFr6+vlyNAWjEPD095eXl5SXJx1Lr75t993eoS+Xl5Tp69KjO nTunNm3aKCQkRFarlYFBvXB1dZWXl5dbbm6uV+242SSvY9u3b9esWbOUn58vT09PlZSUyNfXVzNm zNCgQYNuev\/S0lKlpKRo\/\/79stlsDvMdbIZhyGQyqVOnToqLi+P69Q7EbDbL2dnZWZLz\/3srzMnJ idGpIykpKUpKSlJCQoIyMzO1a9cuZWZm6rHHHtMTTzyhDz744Ib3P3HihB5++GElJyeroqJCzs7O MpvNDnGzWCwym83auXOnhg8frrVr1zLhDuTKSsBkYSjqXn5+vn71q19p7ty5SkxMVHZ2tlJTUxUZ Galnn31WzZs314wZM9SvXz\/5+fn9x\/0rKiqUlJSkPn36aO7cuQ79rakbN27UpEmT1LlzZ3HasmNh VV0PNmzYID8\/PyUmJmrfvn2Ki4vTihUrNHLkSH366acaPXq02rZtqw8\/\/PCa99+0aZOqq6s1c+ZM h\/865KFDh+rRRx\/VwoULmXjibvqysrLUo8d3n7xLTk5W\/\/79lZqaqmHDhmnx4sWSpO7duysrK+ua 99+3b5969uypZs2aNYqft2\/fvsrOzmbiibvpa9asmQoLCyVJYWFhOnDggLZt26aMjAxdvSZdYWHh dS886efnp4sXLzaanzc3N1dubm5MPHE3fREREcrMzFR+fr4mTZqkmJgYvfTSS+rbt69eeuklXbhw QXv27FFkZOR1N3UzMzOVnp7u8D9rWVmZ\/vrXv4prADgeDqjVg8jISIWHhyspKUlr167VrFmzNGvW LEnfHSwbO3asevTooaioqGvePzAwUFOnTlVSUpKmTZumPn36yGw2yzAMh\/kZTSaTTp8+rddff13+ \/v4aN24cE0\/cd4dFixZpzJgxioiIUEJCggICApSTk6PVq1erVatWeuutt254\/4kTJ6p9+\/ZauHCh 5s+f75A\/o6urq+Li4jR16lR999YqHDXuaoaj7jRv3lzr1q3TqlWrtGHDBm3btk1eXl6aNGmSEhMT Zc8FMUaMGKG4uDgVFxersrLS4Y6ce3l5iROfHDvuAElRkoYwHHXLxcVFY8eO1dixY\/91VtetMpvN atGiBYOJ24r7vyRNEQfX6n0fFbiTnCS5EzbQNONmXxtoonEDIG4AxA2AuAEQNwDiBogbAHEDIG4A xA2AuAEQN0DcAIgbAHEDIG4AxA2AuAHi5oLTQBONe4ekXZIKGQ6gacX9nqRISW8wHEDTYZFUc+VW xHAATWvNfRVXzQeaaNwAiBsAcQMgbgDEDYC4AeIGQNwAiBsAcQMgbgDEDdydLHX9gB999JFycnIY WeA2REdHKzAw0PHi3rRpkxYtWqSOHTsyS8BtmDNnjrZs2VIngddp3IsXL9bEiRP18MMPM0vAbXj8 8ceVmZlZJ3Gzzw00UcQN3AVxGwwH0HRY9O\/LGzdnOICmFffjkiZJCmY4gKYVd39JvRkKoOntc9sY BqBpxg2AuAEQNwDiBkDcAIgbIG4AxA2AuAEQNwDiBkDcAHEDIG4AxA2AuAEQNwDiBojbzDAATTPu S5KqGQqg6cU9X9IYSZsZDqBpxX1G0ipJWxkOoGnFfRX73kATjRsAcQMgbgDEDYC4ARA3QNwAiBsA cQMgbgDEDYC4AeIGQNwAiBsAcQMgbgDEDRA3V0AFmhCLpABJUZKGMBxA04r7vyRNYRMdaHqb5e6E DTTNuNnXBppo3ACIGwBxAyBuAMQNgLgB4gZA3ACIGwBxAyBuAMQNEDcA4gZA3ACIGwBxAyBugLid GQagaca9Q9IuSYUMB9C04n5PUqSkNxgOoOmwSKq5citiOICmtea+ysRwAE0zbgDEDYC4ARA3AOIG QNwAcQMgbgDEDYC4ARA3AOIGiBsAcQMgbgDEDYC4ARA3QNwAiBsAcQMgbgDEDYC4AeIGQNwAiBsA cQMgbgDEDRA3AOIGQNwAiBsAcQMgboC4ARA3AOIGQNwAiBsAcQPEDYC4ARA3AOIGQNwAiBsgbgDE DYC4ARA3AOIGQNwAcQMgbgDEDYC4ARA3AOIGiBsAcQMgbgDEDYC4ARA3QNwAiBsAcQMgbgDEDYC4 AeIGQNwAiBsAcQMgbgDEDRA3AOIGQNwAiBsAcQMgboC4ARA3AOIGQNwAiBsAcQPEDYC4ARA3AOIG QNwAiBsgbgDEDYC4ARA3AOIGQNwAcQMgbgDEDYC4ARA3AOIGiBsAcQMgbgDEDYC4ARA3QNwAiBsA cQMgbgDEDYC4AeIGQNwAiBsAcQMgbgDEDRA3AOIGQNwAiBsAcQMgboC4ARA3AOIGQNwAiBsAcQPE DYC4ARA3AOIGQNwAiBsgbgDEDYC4ARA3AOIGQNwAcQMgbgDEDYC4ARA3AOIGiBsAcQMgbgDEDYC4 ARA3QNwAiBsAcQMgbgDEDYC4AeIGQNwAiBsAcQMgbgDEDRA3AOIGQNwAiBsAcQMgboC4ARA3AOIG QNwAiBsAcQPEDYC4ARA3AOIGQNwAiBsgbgDEDYC4ARA3AOIGQNwAcQMgbgDEDYC4ARA3AOIGiBsA cQMgbgDEDYC4ARA3QNwAiBsAcQMgbgDEDYC4AeIGQNwAiBsAcQMgbgDEDRA3AOIGQNwAiBsAcQMg boC4ARA3AOIGQNwAiBsAcQN3J0tdPlhgYKCysrK0b98+Rha4DQUFBWrZsqXjxf3MM89o8eLFWr58 ObME3GZDQ4YMcby4Q0JCNH\/+fGYIYJ8bAHEDIG4AxA0QNwDiBkDcAIgbAHEDIG6AuAEQNwDiBkDc AIgbAHEDxA2gcbEwBE1feXm5cnNzlZeXp5KSEl26dElms1keHh7y9vaWr6+vWrduLYuFXwfihsPL ycnR1q1b9fe\/\/11ZWVkqLi6Ws7OzXF1dZbFYZBiGKisrVV5eLsMw5OPjox49eigqKkoDBgyQt7c3 g0jccBSGYeizzz7TokWLdOjQIXXs2FF9+\/ZVfHy8QkJC5OfnJ6vVKrPZLMMwVFVVpcuXLys3N1cH DhzQ7t27NWfOHL322msaNGiQfv7znysoKIiBJW40pN27d2v27Nk6deqURowYoZkzZyo4OFhOTtc\/ rOLs7Cw3Nze1bNlS99xzj0aPHq3y8nLt3btXS5YsUWxsrAYPHqzp06erTZs2DHIjwwG1Rq60tFQv vPCCxowZo3vvvVc7duzQr3\/9a3Xt2vWGYV+P1WpVRESEli1bpg8++ED5+fmKjIzUu+++y2Cz5sad cvToUT3xxBPy9PTUxo0b1bVr1zp9\/NDQUK1atUqbN2\/W1KlTlZqaqgULFsjd3Z3BZ82N+pKenq5h w4YpOjpaW7ZsqfOwa4uNjVVqaqq++eYbDR06VHl5eUwAcaM+pKWlacyYMXrxxRc1e\/Zsmc3men\/O du3aaePGjerQoYNGjhyp\/Px8JoK4UZf279+vp556SjNmzND48ePv6HO7ublp2bJlCggIUEJCgsrK ypgQ4kZdyMvL01NPPaVJkyZp3LhxDfY6li5dKmdnZ02ZMoVJIW7UhcmTJ6tr16567rnnGvR1WK1W vfPOO0pNTeVLH4kbP9R7772nw4cPa8GCBQ7xetq2bas33nhDs2fP1rfffssEETduR0lJiebOnasX XnhBrVu3vqX71tTUyGaz2XW7VbGxsQoPD9fvf\/97JskB8T53I\/Duu+\/K3d1diYmJdt\/n0KFDSk5O 1uHDh2Wz2WQymW64vGEY8vDwUEREhMaPH6+2bdva9Tyvvfaahg4dqmPHjik4OJjJIm7cypp32bJl mjhxot2f2lq+fLleffVVDR48WM8995y8vb1lGMZ1lzeZTDIMQ2fPntXq1au1bt06LV26VPfee+9N nyskJEQRERH685\/\/rLlz5zJhxA17ffLJJ6qqqtLw4cPtWn7Hjh165ZVXtGTJEg0ZMuSWn2\/UqFGa N2+exo4dq+3bt9t1Tvljjz2mmTNnqrS0VM2aNWPS2OeGPTZt2qTevXvbfcrnb3\/7Wz3\/\/PO3FfZV zz\/\/vHr16mX3mjgmJuZf\/7GAuGGHy5cva+\/evYqLi7Nr+SNHjqi4uFjx8fE\/+LkTEhK0d+9eVVVV 3XRZZ2dnPfDAA0pLS2PSiBv2OH36tC5duqTQ0FC7ls\/Ly5NhGHYfDLsRf39\/lZeXq6CgwK7lIyIi dODAAVVXVzNxxI2bOX78uFq0aCFfX1+7lr\/RQbP6FhQUpIKCAl28eJGJI27YE3e7du3k6upq1\/JX 3+6qi8ivPsbN3kK7ytfXV9XV1XxijLhhj7Nnz8rHx6dRvFYPDw95eHjo\/PnzTBxx42ZKS0tltVob xWu9evHFkpISJo64Yc+m8e1cKqkhmEwmmUwm1dTUMHHEjZuxWq0qLy9vFK+1srJSNpuNk1iIG\/bw 8\/NTUVFRo3itly9fVmlpqd1H9kHcd7UuXbro7Nmzdp1I0tAKCgpUU1MjPz8\/Jo64cTPBwcHKzc1V YWGhXctf3d+19+2rG\/5iXNnXt3cf+tSpU\/Lw8FDLli2ZOOLGzXTs2FEWi0XZ2dl2Le\/u7i6TyVQn ++llZWWyWCxyc3Oza\/nMzEx1797d7vfkQdx3tRYtWig0NFQff\/yxXct369ZNNTU1ysjI+MHPnZaW pjZt2sjLy8uu5Xfs2KF+\/foxaQ4at9GQpy\/i2h566CFt377drmU9PDw0cuRIzZw58wddmfTgwYNa unSpnnnmGbuW\/\/LLL1VSUqKBAwcyYQ4ad+XtXGoH9WvYsGEqLi5WamqqXcs\/\/\/zzatu2rYYMGaJd u3aptLRUNptNFRUVN71dvHhRq1ev1ogRI\/Tkk09q0KBBdj3nypUrFRQUpA4dOjBhDezKFzxWS6qq fbGGy6WlpYyOg2nevLliY2P19ttvKzo6+qbLu7i4aMWKFfrDH\/6gX\/ziFzKbzXJxcbHruS5fvixX V1f95je\/0ahRo+y6T25urlJSUvSnP\/2JyXIANptNpaWl5ZJKa8d9MT8\/35BkYogcyzPPPKOBAwcq LS1NAwYMuOnyrq6uevnllzVhwgQdPXpUJSUldh1B9\/HxUdeuXW\/pRJSFCxcqJCRE\/fv3Z6IcQGlp qS5evFgiqaB23Hl5eXk2wzBc6+KtFNSd9u3ba\/z48ZoxY4bS0tLs\/vogHx8fPfjgg\/X2ug4ePKg1 a9ZoxYoVTJKDyM3NVVlZ2UVJubX3ub\/Nz88v5zugHNPUqVNlMpn0u9\/9ziFeT0VFhSZPnqxHH33U rgsp4s7IyclRTU3NWUkn\/1\/ceXl5Z3JzcxkhB2SxWLRgwQIlJyfb\/dZYfXr55ZdVWVmp6dOnMzkO JCsrS5KOSvqmdty2\/Pz8Q\/aeMIE7Lzw8XHPmzNEvf\/lL7dmzp8Fexx\/\/+Edt2rRJ77zzDietOJgv v\/xSkr6SlP\/9k1j27927lxFyYKNGjdLEiRP16KOPKjMz844\/\/5tvvqk33nhDy5cvV1BQEBPiQEpK SnTo0KFLkr6QdOH7\/x4VHR1dU1VVZcCxzZ8\/3\/jRj35kfPTRR3fsOV955RWjc+fOxu7du5kAB7R7 927Dw8NjrySzrv5RS1l+fn5sYmJiKz4A4Nj69u2rNm3aaPLkySosLFRERITdR9Fv1T\/\/+U+NHj1a Bw4c0Pvvv6\/w8HAmwAGtWbNGGzZs+JukrdJ\/nlueV1JSkr5hwwZGqhFISEjQhx9+qO3bt2vQoEHa uXNnnT6+zWZTcnKyoqKi5O\/vr9TUVLsvs4w7q7q6WuvXr5ekGx5t\/cnAgQOrKysr2c5pJMrKyox5 8+YZ3bp1M+Lj441t27YZFRUVt\/14hYWFxpIlS4zevXsbffr0MbZs2cIgO7g9e\/YYzs7OeyT965M+ 1zpbxcVisaTv2LGjd0REBP8lNiLnz59XcnKy1q5dKzc3Nw0ePFhRUVEKDQ294Vf\/VlZWKicnR59\/ \/rk++eQT7dq1S97e3ho3bpwSExM5It4ITJw4UW+++eY0Sb+9UdySNHHcuHELly5dyqg1QkVFRUpL S1NKSoqOHDmiqqoqeXp6qlWrVvL29pabm5tqampUVlam\/Px8XbhwQWVlZfL29lbv3r0VHx+vXr16 2X1OOhrWyZMnNXDgwAsnT57sLSn7ZnG39fDwSMvIyAju0aMHo9eI2Ww2HT16VMeOHdPp06dVVFSk kpISmc1meXp6ytfXVwEBAerWrZsCAgIYsEZo9uzZmj59+gJJU2r\/\/Y1OIv\/vJ598cs5f\/vIXRg9w UDk5OXrwwQfzzpw5M1DS4dr\/dqMrsSxduXLlIXsvFADgzps7d67OnDnz9vfDvtmaW5Iei4qKWrV1 61YT+1+AY9mxY4eGDh36dVlZWZSk\/\/gep5ud9XD41KlT97i7u3fn87qA4ygqKlJSUlLNyZMnJ0m6 5nnI9pzStC8zM3N43759m3fu3JlRBRzAtGnTtGbNmqWS\/ud6y9h7VYaR3bt3f3fz5s0uXCcLaFgr VqzQ2LFjD9TU1Ay51ub4ray5JenI+fPnTV999dXARx55RBaLhREGGkB6erpGjx6dX1FRkSAp60bL 3sonDTJOnDjRKS8vr+fDDz8sLsUE3Flff\/21Ro0aZTt79ux4SdtutvytxG1I2r5v377QoqKikMGD BxM4cIdkZ2crISGh+vDhw1Mk\/a8997nVzwjaJG39xz\/+0bOgoCAwJiam3j5mCODfa+z4+PiaL774 4gVJC+293+2UeVnS5szMzKCTJ0\/eEx0dLavVygwA9SAjI0OjRo2yHTlyZJKkRbdy39td7ZZL2nDw 4MGW6enpvSMiIuTj48NMAHVo5cqVGjNmTP6ZM2eekvTXW73\/D9mmrpK0KScn58K6desi27dv7xIa Gsp+OPADFRQU6MUXX9S0adM+v3z58iOSUm\/ncepihzmzpKQkbf369d3PnDnj36dPn1v6xgoA\/\/bZ Z5\/p8ccfr0pJSXnLMIxxkr653ceqq6Nh3xqGsXr\/\/v3WlJSUcB8fHwtrccB+586d06uvvqopU6ac yMnJeVbSXEllP+Qx6\/JQt03SxwUFBWnr168PyMjI6NSmTRtTx44dOaIOXEdeXp6WLl2q8ePHX\/zo o48WV1ZWPimpTi5KX1+rVmdJj5jN5skxMTF9xo8fr9jYWLm7uzObgKRTp05p5cqVWrZs2eWjR4++ L+kPhmF8UZfPUd\/bze6SfmoymcZ37949MiEhwX3o0KEKDg6Wm5sbM4y7yoULF7Rnz56rlyD+9vz5 8ymSlkr6XPruu7UbU9y1N\/9\/LGmEh4fHsHvvvbfbwIEDnfr166fw8HDeRkOTVF1drezsbO3Zs0c7 d+7Up59+Wnrs2LH06urqdZK2SDpde\/nGGndtbpLukzTQbDb39\/PzCw4LC2sTEhLiEhwcrE6dOsnP z08eHh5ydXWVq6urnJyc+E2BQ6qsrJTNZlN5ebkuXryoc+fO6fjx48rKytKhQ4eKjh079s+SkpLP JaVJ2iHphKSaaz1WU4i7NoukdpI6SQqW1FVSexcXl9YeHh4trVarh6urazMn6oZjMlVWVpbbbLay srKy4kuXLuXX1NSc03dXIP1a331q65SkAnserK7j\/r8BAPXu07GQUgoNAAAAAElFTkSuQmCC\" transform=\"matrix(0.9999 0 0 0.9999 105 63)\" \/><\/g>",
		  "iphone_frame_5": "<g><image overflow=\"visible\" width=\"228\" height=\"479\" href=\"data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOQAAAHfCAYAAABAnXRXAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA IGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAABjTSURBVHja7N17VNR1 \/sfx1wzMIFcVkQUhbRW0vKAk3shOKhhqKXnBdLFSdzczW01Plqv1O6ey3WPWWnb2Z3rcfqub66VS tPCemht4gc1EpBVJaxVIMUBguAww398fWj\/XXwWKzozyfJzjP54vzJz3hyfzvc1gEuA6gyVNl1Qn yXDC41kkfSPpZUnljB\/4PyZJn10O0dn\/HnXXoXi60XOxSmopyU+S1+XfZrg91V9e6\/YuevwYSemS fCXZJVVLskkqufxq7dLfUq4QIClCUh9JXb29vSMDAgLCfXx8Anx9fb28vb0tnp6eHoZhGPzs3tYC JHm44HFtkmpMJpO5tra2vqqqyl5ZWWm32WylZWVlZ6qrq3MlZUvKkPS1pIrbMcgQSQ9Iig8KCuoV ExNzV79+\/SzdunVT+\/bt1bZtW7Vq1Uq+vr6yWCwym838uOKmMwxD1dXVqqysVElJiYqKivTNN98o KytLhw4dqjpy5EhuSUlJpqSdkvZIunArB+kp6T5Jj0ZERIxISEj4RUJCgmJiYhQSEiKTycRPBNyW w+FQQUGBDh48qG3btmn37t35\/\/73vzdJWiPp4K0UpEXSg1ardeaQIUPu+\/Wvf+05ZMgQBQYGssq4 ZRUVFWnbtm1auXJl9cGDB\/fV1tYukfTJ5WNit3W\/p6fn3qSkJCMtLc1wOBwGcDupq6szdu3aZQwf Prxe0hZJfd0xxFBJ78TGxtp37drFquG253A4jI0bNxpRUVFVkhZdPnPsFka0bt06b9GiRYbNZmOl 0KyUlZUZ8+fPN1q0aPGFpPtdGaKnpFf79+9fm5mZycqgWdu3b5\/Ro0ePSkmzXXUNad3UqVON0tJS VgMwDOP8+fPGqFGjDEn\/Lcn7WqO63ouy7SRteOWVVx5644031KJFC07BAZJ8fX01fvx4lZeX9zl4 8GB3Sdt16U6gmxZkmMlk2vTGG28MfP7551kB4Cpms1kJCQmSdNenn356j6TUxkZ5rUG2MZlM6\/\/0 pz\/dO3v2bCYP\/IxBgwbJ4XB02r9\/f9fLl0dqb2SQXpJW\/\/GPfxz27LPPMm2gEQYPHqzKysou6enp oZI+VgNvM7uWIP80a9asxxcuXMiUgWsQFxen3Nzc6Ozs7GpdesvZT2rsrXOPJSQkrNq4caN8fHyY MHCNioqKNGLEiJrMzMyHdelEz3UH2SUkJGTf\/v37QyIjI5kscJ0OHTqkYcOG5ZSWlj4gKf96d1lX vvXWWzHx8fFMFGiC8PBwmUymtrt3726lSyd5rvkV8lejR49e8+GHH\/JWKTdWUVGhY8eOqba2Vnff fbfatm3LUNxUdXW1RowYUb93794RuvQey0YHGejn5\/ePPXv2dO3Tpw+TdFPvvvuuVq5cKS8vL5nN ZpWXl2vkyJGaN2+eLBY+BcUd7dmzR8OGDftHbW3tUEk1jf26uc899xz3QrmxxYsXG7179zbS09N\/ +L\/c3Fxj+PDhxrRp0xiQG5s8ebIh6bHGxhgUHBx88uTJk0zOTWVnZxvR0dFGXl6eUV9fb\/z5z382 XnrpJaOoqMiw2WxG\/\/79jU2bNjEoN5WRkWF4e3sf0KXr+z\/4qQ+uGTNhwoSIiIgI9i\/c1EcffaR+ \/fqpU6dO+v3vf6+UlBR9\/fXX+u1vfysfHx8lJydr06ZNDMpNxcTEaOTIkf0lPdRQkJ5eXl6TJk+e zNTc2IULF9SxY0dJ0t69e\/Xiiy\/qnXfeUV5envLz8xURESGbzcag3NjkyZNlMpkeayjI2MGDBw\/o 1asXE3NjYWFhysnJkSQlJyfr2Wef1bBhw3TvvfcqLCxMx44dU6tWrRiUGxsyZIhiYmKGSLr7h1fD H9luVGJioieXOdzb6NGj9d577+ngwYOaNWuWoqKi9N1332ns2LEqKCjQhg0b9NprrzEoN+bl5aXE xES\/jIyM4ZK+\/LFt\/Fu3bv3PU6dOcdR9C1i1apXRuXNn4+9\/\/7tRXV1t1NXVGXv37jV69+5tvPji iwzoFnDo0CHD19d3z\/cBXv0yGD106NDD27dv9+SDim8NO3bs0JtvvqmSkhKZzWZZLBZNmTJFnAO4 NdjtdvXp0+d8VlbWvZLyrt5lHTBw4EBivIUkJCRoyJAhKigoUF1dnUJDQ3kDwC3EarUqNjY2OCsr q6ekvKvL68NdObcei8WiDh06qFOnTsR4C+rbt6906Q8A\/cdZVlNQUFC3X\/7yl0wIcKIePXrIZDJ1 ldT2yiDbtWnTJjQsLIwJAU4UEhKidu3adZEUeWWQwaGhoQH+\/v5MCHCili1b6he\/+EX41UG2DgsL 82U8gHP5+PioVatWvpLC\/yPIwMBAD8YDOJeHh8f3d1UFXXnZw8\/Pz4\/puEBpaan+9re\/6fPPP1dt ba3L3wxuGIYCAwM1YcIExcbGskBOcPlQsdWVQVqtViuTcbL8\/HxNnDhRISEhGjRokCwWixwOh0uf k9lsVn5+vmbMmKEpU6Zo5syZLNRNdrk965VBmrh\/1fnmzp2rAQMGaNGiRW733JKTkzV+\/Hjdc889 GjhwIIt1E33fHrfkuNCJEyd09uxZuesHT0dGRioxMVHr1q1jsZy1d8IIXKe4uFgeHh5u\/aFUoaGh unjxIotFkLe\/zp07q7q6WpmZmW77HNPT09WtWzcWiyBvf23atFFSUpKefvpp5eXludVzczgcWrJk iU6cOKHf\/OY3LJaTeDIC15o9e7bsdrvGjx+vwMBAWSwWGYbh8hMMpaWlat26tVatWqWgoCAWiiCb B5PJpHnz5mnSpEnKzc2V3W53i+uQbdu2Vffu3eXl5cUiEWTzEx4ervDwcAbBMSQAggRAkABBAiBI gCABECRAkAAIEiBIAAQJECQAggQIEgBBAiBIgCABECRwSwdpMA7AfYKsZxyAa3lK6qdLf9\/8CcYB uD7IZEmjJHVgHIDrgzRLavIHgRYXF+uDDz5gomiWAgMDNW7cuBsSpHEjYoyMjLwhTwi4FRUXF6uo qEjTp09vcpBNlp+fr7CwMC1fvpyVQbN07NgxJScnNzlIrkMCboQgAYIEQJAAQQIgSIAgARAkQJAA CBIgSAAECRAkAIIEQJCAuwVpkeTBKAD3CDJdUpqkWsYBuD7I1ZIekTSPcQDucwxZxjgA9wmSEzyA GwUJgCABECRAkAAIEiBIAAQJECQAggQIEgBBAgQJgCABggRAkAB+NEiDcQDuE2Q94wBcy1NSP0kx kp5gHIDrg0yWNEpSB8YBuH6X1SzJxCgA9wiSkzmAGwUJgCABECRAkAAIEiBIAAQJECQAggQIEgBB AgQJgCABggRAkAAIEnD3IC2SPBgF4B5BpktKk1TLOADXB7la0iOS5jEOwH2OIcsYB+A+QXKCB3Cj IAEQJACCBAgSAEECBAmAIAGCBECQAEECIEiAIAEQJECQAAgSwI8GaTAOwH2CrGccgGt5SuonKUbS E4wDcH2QyZJGSerAOADX77KaJZkYBeAeQXIyB3CjIAEQJACCBAgSAEECBAmAIAGCBECQAEECIEiA IAEQJECQAAgSAEEC7h6kRZIHowDcI8h0SWmSahkH4PogV0t6RNI8xgG4zzFkGeMA3CdITvAAbhQk AIIEQJAAQQIgSIAgARAkQJAACBIgSAAECRAkAIIECBIAQQIgSIAgARAkQJAACBIgSAAECRAkAIIE CBIAQQIECYAgARAkQJAACBIgSAAECRAkAIIECBIAQQIECYAgAYIEQJAACBIgSAAECRAkAIIECBIA QQIECYAgAYIEQJAAQQIgSAAECRAkAIIECBIAQQIECYAgAYIEQJAAQQIgSIAgARAkAIIECBIAQQIE CYAgAYIEQJAAQQIgSIAgARAkQJAACBIAQQIECYAgAYIEQJAAQQIgSIAgARAkQJAACBIgSAAECYAg AYIEQJAAQQIgSIAgARAkQJAACBIgSAAECRAkAIIEQJAAQQIgSIAgARAkQJAACBIgSAAECRAkAIIE CBIAQQIgSIAgARAkQJAACBIgSAAECRAkAIIECBIAQQIECYAgARAkQJAACBIgSAAECRAkAIIECBIA QQIECYAgAYJkBABBAiBIgCABECRAkAAIEiBIAAQJECQAggQIEgBBAiBIgCABECRAkAAIEiBIAAQJ ECQAggQIEgBBAgQJgCABECRAkAAIEiBIAAQJECQAggQIEgBBAgQJgCABggRAkAAIEiBIAAQJECQA ggQIEgBBAgQJgCABggRAkABBAiBIAAQJECQAggQIEgBBAgQJgCABggRAkABBAiBIgCABECQAggQI EgBBAgQJgCABggRAkABBAiBIgCABECRAkAAIEgBBAgQJgCABggRAkABBAiBIgCABECRAkAAIEiBI AAQJgCABt+N5I75JYGCgiouLtWLFCiaKZik\/P1\/jxo1zjyDDwsL08ccfa9myZawMmqWwsDBNnz7d PYKUpF69emn58uWsDMAxJECQAAgSIEgABAkQJACCBECQAEEC+DGejODWZbPZdOHCBZWXl6uyslKG YcjX11f+\/v5q3bq1AgICGBJB4mYxDENHjx7Vzp07dfToUeXn58tut8tqtcrDw0OSVF9fL7vdLk9P T4WHhys6Olrx8fHq2bOnzGZ2iAgSTVZTU6MNGzbovffeU0VFhaKion6IrH379vLx8ZHFYpFhGKqr q1NVVZUKCgr0+eef69ChQ3r66afl4+Ojxx57TOPGjZO3tzdDJUhcj5SUFL3++uvy9\/fXk08+qbi4 uJ\/dFbVarfLx8VGbNm3Uo0cPPf7446qoqNCePXu0YsUKrVixQs8884zGjh3LcAkSjXX+\/HnNnj1b X331lV544QU9+OCDMplM1\/W9\/Pz8NGrUKI0aNUqpqalauHChNmzYoLffflvBwcEM241wUOGGDh8+ rPj4eAUHB+uTTz7RQw89dN0xXu3BBx\/Uvn371L59ew0bNkyHDh1i4ASJn7J9+3b96le\/0rx587Rk yRL5+vre8Mfw8vLS4sWLNWfOHE2cOFFbt25l8Oyy4mq7d+\/WtGnT9M4772j48OE3\/fEmTZqk4OBg TZ8+XV5eXoqLi2MReIWEJH355Zf63e9+p6VLlzolxu898MADeu211zRjxgzl5OSwELxCoqamRtOn T9e0adOUmJjo9McfO3aszp49q+nTp2vbtm3y8fFhUXiFbL5efvllhYSE6JlnnnHZc5g1a5aCg4P1 yiuvsCAE2Xzl5ORoy5YtWrhwocufyx\/+8AelpqYqKyuLhWGXtXlavHixHn74YUVERDRq+4yMDK1e vVoFBQVyOBw\/eznEZDIpJCREEyZM0H333dfg946MjFRSUpLeeust\/eUvf2FxCLJ5OXHihP71r3\/p 5ZdfbtT2r776qtatW6cJEyZo8ODB8vT0lGEYPxmjw+FQbm6uZs6cqbi4OC1atOiHe15\/ytSpU5WY mKiTJ08qMjKSRSLI5iMlJUXdu3fXHXfc0eC2y5cv15YtW7Rt2zaFh4df0+NMnTpVDz\/8sBYvXqx5 8+b97LZhYWGKjo7Whg0btGDBAhaJY8jmweFwaNeuXY36+PnS0lL99a9\/1euvv37NMUpSUFCQli1b pk2bNqmgoKDB7ceMGaO0tDTV19ezUATZPJw+fVpVVVWKjo5ucNucnBxZrVb179\/\/uh+vR48eCg4O VkZGRoPbDhw4UKWlpTp58iQLRZDNQ2Zmptq1a9eom7vLysrk6+sri8XSpMcMCAhQeXl5g9v5+\/sr JCRE2dnZLBRBNg95eXlq3759o7b9\/gRNUxmG0eib1Dt37qzjx4+zUATZPBQUFCg0NNRtn19oaKjy 8\/NZKBcGafzUKXTceBcvXnTrz7wJDAxUZWUlC+Ukl0+gOa4M0m6325mMkzgcjiYfE95MVqtVdXV1 LJSTXG6vxvyf5w7KmIyzdk3MZtXW1rr1D4inJ5epnaWiokKSyq4M8uJ3333HhScnadmypdz5F2BJ SQnv+nCSuro6lZaWSlLRlUF+l5+fX8F4nCM0NLRRF+ldpaCgQGFhYSyUE9hsNpWUlJRLOnNlkOcK CwvLLl68yIScIDIyUmfOnGnUttdyueLnmEwmNfbE3cmTJ9WtWzcWygnKysp07ty5f0vKvTLIb4uL iws41e0cvXv3VkFBgYqKihrc1sfHRzU1NU2+lc1mszVqN7S8vFyFhYXq3r07C+WkvZHCwsJcSXn\/ cR2yuLj4aF5eHhNygo4dO8rb21tHjhxpcNu7775bZWVlOnbs2HU\/3ldffaVz586pV69eDW6blpam Vq1aNfotYWiay+8\/zZZUfPWNARmNudcRTWc2mzV06FB98MEHDW7btm1bjRkzRs8\/\/\/x1XRusqanR nDlzdN9996ljx44Nbp+SkqK+fftyltVJDh8+LEkZ0v9\/+1VGWlqavb6+3trQ++bQdImJiZoyZYrO nj3b4Ls45s+fr2+\/\/VZxcXF68sknFRERIQ8Pj599P6RhGDp9+rSWLVumO++8s1HvuywoKFBmZqbW rFnDAjlBVVWVDh48+O3lV0hdfabAx9\/f\/5OMjIz+Xbp0YVpOMHnyZLVv375RsTgcDm3evFlr167V hQsXVF9f3+DJnjZt2igpKUlJSUlqzC\/ZV199VadOneITA5zks88+U3x8\/Paampqf\/KjBhW+++aYB 5zh+\/LjRvXt3Iycn55q\/1uFwNPjvWpw4ccLo0aOHcfToURbGSV544QVD0owfDmV+JMiPUlJS7Nw2 5Rxdu3bVmDFj9NJLL13z15pMpgb\/XYsFCxZo5MiRioqKYmGcoLKyUlu2bCmRtOPngszYv3\/\/fk7u OM\/8+fNVWFiopUuXuuw5LF26VOfOndP8+fNZECfZsWOHsrKydktq8NLGpCeeeIL9CSfKzs42Onfu bGzevNnpj\/3hhx8anTt3NrKzs1kIJ0pMTHRIGtGYeP3btGlz7HqOa3D9du7caXTo0MHYvn27Ux+z Y8eOxo4dO1gAJ0pPTzcsFssnkhp9OWPajBkzmJyTpaamGh07djTWrVt30x9rzZo1xp133ml89NFH DN7Jxo8fb0gadS27uH7e3t6Z+\/btY3pOduDAASMqKsqYO3euUVlZecO\/f3V1tfHcc88ZPXv2NNLT 0xm4k23evNkwm83X9TcAx8bHxxs1NTVM0ckKCwuNRx55xOjfv7+xdevWG\/Z9t2\/fbsTGxhpjx441 CgsLGbSTlZaWGn379q2RdP\/1ngxavWTJEibpIu+\/\/74xYMAAY\/jw4cbGjRuN0tLSa\/4eZWVlxubN m42RI0caAwYMcMruMH7cggULDEmLf\/JSViOC7NCyZcs9+\/fv78j1KdfdXrV+\/XqtXbtW5eXlio6O Vr9+\/dSzZ0+Fh4fL19f3h7tw6uvrZbPZlJ+fr6ysLB04cEBffPGFfHx8NGnSJI0fP17e3t4M1QV2 7typkSNHZtrt9gRJxdcbpCSNiY2NXb9582bPoKAgJusihmHoiy++0I4dO3T06FEVFBSotrZWVqtV Hh4eMplMqq+v\/+HjN0JDQ9WrVy8lJCSoZ8+eMpv5kEFXOXPmjIYNG1aRk5OTICm9Ka+Q33sxOTn5 5VWrVokbz91DRUWFioqKVF5eLpvNJkny9fVVQECAgoKC5Ofnx5DcQHV1tcaOHautW7c+LenPN+r7 miT9z9y5czkQABqptrbWmDx5siHptcZEdq0vdXvS09OjzGZz5\/vvv59ffcDPqK+v18yZM7Vy5cq\/ SpolybjRQdolbdu3b1\/P6urqiLi4uBvyWS\/A7aampkZPPfWUVqxY8Z6kJy+3c8NfISWpWtJHaWlp HYqKinoMHTqUY0rgCjabTVOnTtXq1avflvRUY2O83iAlqUbSxxkZGYFHjhzpO2jQIPn7+7MSaPZO nz6tpKQkIzU19SVJ8yRd019JaspLW72krSdPnvwuNTV1YJcuXbw6derEiqDZev\/99zVx4sTiY8eO TZP0tiufS3+LxZIxZ84co7i4mFNraHa3OU6ZMsUwm817JXVtSkg36uDvrMPhWHfgwAEjJSWlZ1BQ kNddd93FhWjc1ux2u9599109\/vjjJfv27fsvwzBmSvrW3Z5nlMlkWj9o0CB7SkrKTXm3AuBKZWVl xtq1a42YmJgKSX+RdMM+wPZmXrMYKOmpmJiYxEcffdRn9OjRuuOOO\/i1ilvWqVOntH79eq1Zs6bs +PHjH+rSXTf\/vJGP4YyLiFGSJgUGBj40dOjQu4YPH26655571KVLF1mtVlYZbquyslK5ubk6fPiw UlNTHZ9++mn2xYsXN0laI+nkzXhMZ17Vbympr6R4f3\/\/2IiIiLv69u3bpmvXrqbIyEiFh4crICBA Xl5eslgsHH\/iprvyZny73a7S0lKdOXNGubm5ys7ONg4fPnz+66+\/\/tJms30madflV0PbTX1OLpqF WdIvJXW\/fFYq0mq1tmvZsmWQn59fQIsWLXw8PT2tasStRkATgjTV1tbaq6qqKmw2W3lJScn5urq6 \/Muvfjm69Gni3zjzOf3vAFh5JoSHJM43AAAAAElFTkSuQmCC\" \/><\/g>",
		  "iphone_4_screen": "<g><rect x=\"66\" y=\"58\" fill=\"#A6A6A7\" stroke=\"#000000\" stroke-miterlimit=\"10\" width=\"195.488\" height=\"290.963\" \/><\/g>",
		  "iphone_5_screen": "<g><rect x=\"83.256\" y=\"32.251\" fill=\"#A6A6A7\" stroke=\"#000000\" stroke-miterlimit=\"10\" width=\"193.488\" height=\"343.208\" \/><\/g>",
		  "iphone_keyboard": "<g><image overflow=\"visible\" width=\"193\" height=\"131\" href=\"data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMEAAACDCAYAAAA00n\/7AAAACXBIWXMAAAsTAAALEwEAmpwYAAAA IGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAADDCSURBVHja7H3ZU1tL kv53Nu0rYpMQEovYbWNsA8bbbaaju6NfJqIf5g\/oP+33PhEzLzeix\/fat71e29jGK5vZN4F2oV1n 0e\/BUzUSIDhHyAttZQQRIKRUnazMqsysrC+Zv\/3tb\/8PwFUARTSoQT8W6QC84gEMARhpyKNBPyhl WQD5hhwa9ANTnm3IoEE\/OjWMoEE\/PPHHvVgqlVQzYBjmxP\/\/CLy08Ksnr4b86yP\/CiMQRREsq21z UBQFHMcd+ZwkSaofoJwXy7LgOK7idVmW6f\/UEhEKz\/NHvkOW5ZqeUxCEI98hSVJNvHiePyKbhvy\/ jfz58n8EAgEEAgGwLKvKsliWRTQaxbt371AoFOhgJEmC2+3GyMgIBEFQxYthGGQyGbx\/\/x7xeJwK T5IkOJ1OXLx4EWazWTUvURTx8eNHBINByktRFOj1ely6dAkulwuKoqjipSgKlpeXsba2Rp+RKMXo 6Cg8Hg8Yhjl1bOQ9u7u7mJubq1Cshvy\/nfz5UqkEWZbh9\/tx+\/ZtzVtVR0cHDAYDHj16hFKpBEVR 4HQ68Yc\/\/AFGoxGyLKvmJQgC7HY77t69C1EUAQAGgwG3bt1CW1sbfU0NcRyHlpYW\/OMf\/0AikaDC m5iYQH9\/P4pF9cciDMPA7XZDkiRsbGyA53nIsoyLFy9ifHwckiRp2o69Xi8YhsGbN2\/AsiwkSWrI \/xvJn2GYz0agKAq1Ji2DIxbZ2toKvV6PQqEAWZbR0tICg8GAQqGgiZcsy3A6nbDb7QiFQgAAu90O p9OJfD6vSTkkSYLBYEBLSwui0SgYhoHBYEBrayvy+byqVaic9Ho93G431tbWUCqVwLIsPB4PRFGk rocWV8HtduPdu3doyP\/by79u2SEtvufX5FUvKpVKR8alRSm+NDXk30iRNqhB9U2RHo6+iRWWSiVw HHcke3DS5xVFAcMw1Cc86TWWZVVF+ietAFpWsfKxHBd01rJa1WOFJeMivvVh94fMh9oxVvtMLbzU jrMWPoTXcRkqtXyOmwOGYU6UPX+S4BiGQWdnJ1paWiAIApLJJHZ3d3FwcHAkXXXcgPR6PXQ6HfL5 PA2qeJ6H0WhEoVBAsVgEwzDgOA4WiwWKoqj2ic9qCKVSCTzPH5s9KRaLEEXxSHrvaxhCqVSCTqeD Xq+HLMvIZrP0M6VSCQaDATqdjv5PzXgMBgMEQUCxWKQyr\/a6luckcymKoub4ozwOAQCHwwGLxQJZ lpFMJpFOp49NI58WjB\/WS0VRkM\/nTzRU\/qQ86uTkJHw+X8X\/stksXr16hY2NjaqGwDAMJElCd3c3 xsbGsL6+jufPn0NRFPT39+PixYsIBoN48uQJRFFEb28vrl27hu3tbbx48aKqIimKAp1Oh4mJCQiC cGT1EkURL1++RDabPXVlkyQJXV1dGB0dPSKgTCaDpaUlrKysqFqRyHjHxsbgdDrpWMt3lPKxncZL EAT89NNP4DgOL168wNbWFjiOg8FgwPT0NCwWC168eIHV1dVTxydJEkZHRxEIBLC4uIg3b95AEISq r2sJfD0eD6amphCLxXDv3j2wLKtJaWVZhtFoxNjYGHw+H5VVLpfD4uIi5ufnVS9qoiiis7MT4+Pj dLElehgKhfD+\/XscHBwcK6+qRjA6Ogqfz4dEIoHZ2Vnk83l0dXVhaGgIk5OTSCaTODg4OFHZEokE eJ5HW1sbeJ5HsViEx+OBIAg0g5FMJtHc3AydTodkMlnVPSl3Uzo6OsCyLERRrHh\/sVhUnWMvX8ly uRy2t7fBMAz0ej08Hg\/Gx8eRTqcRDAZVKUepVILJZILD4aC7IFEWWZbpQdhpY2NZFslkEqurq7h0 6RJGR0exv7+PXC6HsbExOBwO7O\/v01ShKp\/3f3e8wwpQ7XXVASXLQhAE+qxad0yO4zA1NYX29nYk Egmsr69Dr9cjEAjg8uXLAIAPHz6oNk6O42AymSCKIra2tgAATU1N8Pv9MJvNuH\/\/\/rEpY\/4467Tb 7ejt7YUkSfj9998RCoXA8zzC4TCMRiO6urrQ29uLV69enahgiUQC6XQaJpMJJpMJLMvCbrcDAIxG I+x2OzKZDFwuF0qlEvb391X5puQE8\/79+0esW5IkTTELAIRCITx48AAcx6FUKuEPf\/gD\/H4\/2tra EAwGVWVTGIbBzMwM9a+np6dhs9nw5MkThMNhcBwHURRVjY3jOMzPz6OzsxNOpxO9vb0IBoPo7++H LMt48+YNZFlWrRzkOQ8bYLXXtbp+WtOdZJ56e3upAdy7dw\/pdJrqwU8\/\/YTh4WFsbm4ik8loGk8y mcTDhw\/BMAzMZjP+8pe\/oLm5GQ6HA+Fw+Mgiy1bLFXMch2QyiXg8DoPBQLeXnZ0dAIDL5QLP81UF yDAMCoUCQqEQOI6DzWaD3W6HwWBAOBymVmo0GuF0OpFKpU7dWY4bK8kTS5IEURRrmlCyopFVjShX KpXSxKdQKCCTyVTk1AuFArLZrKY8O8uyKBaLePv2LQBgeHgYN27cAMuyWFpaQigU0uS6fI9EDsAA YGNjA+l0GgaDAQaDATs7O4hGo9DpdGhubtZ04Fe+KJGAm8i9PLY6cSdgGAY6nY5OYLm1K4pCAyCd TqdKYUOhEHp6etDU1ARRFMEwDJaWlmCxWNDc3Ix4PA6WZREOh1EsFmEwGFRZvCAI+Ld\/+zc6PpZl sbOzg2fPnmn2TVtbW\/GXv\/wFwOdDGZvNhpWVFU0uR7n\/Xy4XkunQmn0RBAHb29tYX19HV1cXjEYj UqkU5ubmagrYv7ecP3FdyGJDdkiivAcHB2hublZdqlFOZrMZ169fR6lUQnNzM2w2G2KxWMXJ9akx AYmmiQujKAq1UqKkuVwOsiyfOCGktkWWZbS3t1Mj2t3dRXd3N\/XXAGB\/f1+zIKPRKDUs4kvXetBD VhsipG+taGQ1+\/DhAzweD3Q6HT58+IBsNksXKS28TnKHvsWzKYpCT3qPy9CRZ5QkSfOc6vV69Pb2 gmEYyLKM3d1dzM7OVnVH+eP80Wg0imKxCJvNho6ODiwuLuLChQvo6emhKcz9\/X1VRnBwcECtGgD2 9vaQTqcRiUTg8Xjg8\/kgiiJisZjq1ZI83PPnzxGPx6lrUL6LaaH9\/X389ttv4DgORqMRf\/rTn+D3 +7G6uoqdnZ1v5npwHIdcLodisQhBEDS7i2RVJQau1+upUsmyTGVVfl7wtUhRFESjUXg8Hng8Hiwt LdFEh81mo\/oSi8U0jyuZTOL+\/fvgOA6KoiCXy9E4VVWKlGVZpNNpfPz4EWNjY7hx4wacTif0ej3M ZjPMZjMODg6wtLR0apDHsiyNC0jqMBKJ0FWcDCwSiSCdTqueYFI7YrPZjjxcsViELMuaBMcwDHie B8dxyGaziEajsNlsMBqN39x1KHftajnQYhgGkUgEAOD1ehEIBBCLxdDU1ISOjg46J7XwPutzra+v o7+\/n6Y2l5eXIQgCLl++TGODSCSiOXulKAoymQyV3WnuMV8tpTY\/Pw+GYTA0NISLFy\/SXKwoijCZ THC73TQNdZKyMgyDcDiMgYEBatk8zyMej0MUReh0OkQiEUiSpGrFJYdrHMdhenr6SEr1t99+w\/7+ vipeZOLL\/dHyIrZa\/NHyVVxtjltNirOWU12yQGxvb2NtbQ3d3d24detWRQn3p0+fKsqdtSrySYdQ p8knmUzi2bNnmJycxODgIAYHBytiyZmZGbrgaR0PicPUyJ+vpmgsy+LDhw\/Y2NiA0+kEz\/NIpVJI p9O4du0a9Hq9KgXhOA77+\/t48eIFXXV0Oh0KhQJmZmZgNBqxu7sLjuNOHTDZxjc3N8Hz\/BHhkMMR NULjeR6hUAivX7+ucDM4jsPa2hoymQw956jF\/97Z2YHZbEahUKjZEMjzvn79mspfqyEQ\/\/vZs2fY 2tpCW1sb9Ho98vk89vb2sLu7W9MuwHEc4vE4Xr16hVwupzkZQWKBra0tJJNJ+Hw+2O12yLKMSCSC ra0t1Snls46HP0l4giAgk8nQVCFh\/PTpU9XBIznUWlxcpA9OVtz19XV6Oq1mIoiSk++vJgw1gmNZ FolEgroC5FlYlkU8Hqe5fa2rHFG6V69eaa61qraar6ys0IxYLQpLDuk2NzexublZcQFFa2lCOc9U KkWze7UmEgRBQDqdxvv37ytSm8Q9\/Rrj4dVY2Fkm8aSAtVbB1Stzw7LsseOq9not7lA9qB6BOVnU 6u3Xn1VO9dKxs4ynUUrdoB+e2MO+bK2rzHE57u+B13H86vGcZxlXtedsyP\/byJ8nzKLRKD3d1JIR 0el0CIVCtBSX+Nok26P1jisJvskgU6kUstksrFar5juukiTRU0KS9Ukmk\/B6vZrvuJKDPyIvSZIQ j8fR0dGhuXZGEATEYjGKFNGQ\/7eTP8\/z4IaGhv7Osqw\/Ho+jVCrRun5Sj3PSjyzLNJVFInISoOTz edjtdnoxRw2vZDKJmZkZRKNRGiwXCgUcHBzAZrPRh1fDK5fLYXZ2lpY+kExLNBqFxWKh5cRqeBWL RczPz2NhYaEi6xCNRukpuizLqnhJkoTNzU3Mzs5S6BESjDfk\/03kv8n87W9\/ewjgNjlZNBqNqsuR gc\/1RWRFKydJkqDX608ssjts7dUus5BVTafTqeYlSRIKhcIRXkTx1Jb\/kmxPLpc7ksYlJ61aD9Vy udyRvH9D\/t9M\/o\/48i\/jeV7zDSFyeHVcBodUdmrhdVzmh+d5Koiz8iLuBqmPOktGiiirVl7H5bAb 8v928j+2bKJedNbg5Ufj1ZD\/t+HVSJE2qJEibYigQQ0jaFCDGkbQoAY1jKBBDfqhqaZKtHK0MLUR fLUCqcOXodXwOqlMVpZlTSeuJ6He1ZNXPWXWkL92XnU1AkmSoNPp6CVpNUKTJIkexZcPUpZlikSh 5oCIHJxkMhn62XLFICeuag+IgM9gYsVisSIPTQ6uzGazpgOifD6PXC537GGT0WiEwWDQdHCVyWSO HBA15K9d\/nU1AkmS0NraiuvXr8NqtapuskBq2WdmZuilF1mWYbFYMDU1Re+TqoUwjEQi+P3335FO p+k9Up7nMT4+Dp\/Pp6phA1k5UqkUnj17RrGVyISOjo5icHBQdS0PUdzXr19jdXW1oslFT08Prly5 omlCZVnGwsIC3r17R5WtIX\/t8ldD3NDQ0N8B+E97I7kgcufOHbS1tVUA6J72w3Ec2tvbkclksLe3 B47jIMsyJiYmEAgENPFiWRbNzc3gOA4bGxu0UGtoaAhjY2MVW\/ZpPwzDUDwkgnsvyzI8Hg9u3bpV ca1RzY\/BYEBbWxs2NjYoXI3VasX09DRdudXyEgQBbrcboVCIomg05K9N\/ipdo03V5kKgBc1mM4rF oubKPVmW4XA4KC+WZWG1WmviVSwWYbVa6RZeKpXo1TytQE3FYpFuu6R5hNVqpS2HtFC5jMhtPLPZ TFEetPi3BHeVrPik3qYhf23y\/yLZobNg1dQT9+Z75lX++Wpw4Q2ZfR35N1KkDWrQl0qRVtu+CbDT We6yljcGKU\/vaU19Hbct19qMohq\/s\/AkrgMJIonvrrVHQDmKW\/nrBAX7rPexCb4rAUjQoguHv1+S pP\/rGKlxXOSzWsbxVY1AURSYTCa0tbVBlmXs7OzUtKURDCGfz0fBupLJJILBoCb4DYZhYLFYKoRF Sm5JOk6rIA\/zKx+z1lJeURThdDrh8XhgsVhQKBSwt7eH\/f191YZAFNPv96NUKmFnZ4fm1U0mE7q6 uijfWhcjlmXR1dUFnucRDAZVwccoigKz2Yy2tjbk83mK6i3LMtxuNywWC4rFInZ3d1XFIgS7yufz QRAE7O3tIZ\/P19UQ6mIEkiShr68Pw8PDAIB79+6pxvUvF54gCJiamqLIaIQikQiePn1KU3Kn8dHr 9ZienoZer6dKVSqVkEwm8enTJ6ysrKjGpSHjunHjBs2nk4CQYRjs7+\/jwYMHFSnE02QVCARoypTQ hQsXMDc3R5GoT+MlyzJsNhumpqZQKpXw3\/\/93\/T2lMPhwPXr13FwcIB\/\/OMfNUGnk2zg+Pg49Ho9 7t69i2w2e+oKLssympqaaA+LnZ0dqh8EJPfp06eqIfTJOMbGxmCxWCiEez2RM\/h67AJGoxGdnZ30 Nb\/frwrX\/7DwhoeH0dHRQa+\/8TyPK1euwO124+LFi3jy5IkqwZF2oYIgYH9\/H8ViESaTCS6XC5OT k+A4DgsLC5rw\/XU6HXQ6HcLhMF0RGYZBPB7XfM4yMTEBhmHw9u1b7OzswGazYXx8HMPDw0gmk1hZ WVHdGIS4jod\/yPedlYgbqGVnJ+8lVyN7enowOTkJWZbx5MkTbG5uaoZGKR\/Hd+cOybIMr9cLq9WK YDAIq9UKr9cLs9mMfD6vCV\/UZrMB+Hz9LZVKoVgs4tmzZwgEAnQV0tpLtxy0d3h4GJcvX8bIyAi2 trY0jw8AZmZm6C5XDgmp9vMDAwNgWRbz8\/OYnZ2lhloqldDX1wedTlfTJCuKQuOMeih\/PUgURXi9 Xty4cYMCKNdiAN91YEwmlsCrf\/z4ET6fD\/39\/Whvb8fy8rLqByYNQLq7uzEwMAC3241YLIZgMIiF hQVkMpmaAHLLg7ClpSUEAgFYLBY4HA7s7OxoDtBsNhuNK0icoQYAmLhpJNYh363T6WA2mxEKhSg8 vZYxEXfh5s2btHSB3N\/91n2W7XY7bt++DZ7nsbKyguXlZVX9J86VERAYbbfbTTtbAkB\/fz+FNlc9 EJ7H+vo6SqUSBgcHaXOFrq4u5HI5vHz5kmKQaiGinOSUNJPJwGKx1DwZt27dqnj++\/fvY39\/X9W4 yrtlEvTslpYW3L59m\/ILBoN4\/PixZgjC1tbWI89cy6JGskr1uOZZLmOv1wuPx\/Nddtk5kxHIsoyO jg7a\/G1iYoKuQq2trXA4HEgmk6r9eLPZjL29PeonO51O9PT0oK2tDWNjYxRf5yy7FhmL1tNIQqur qzRAL5VKqjplkucjrU4NBgOVUy6Xoyuk3++vqQGHJEn49ddfUSgUaBZmampKkzGQ2K6\/vx+ZTAZb W1tn3klkWcaLFy\/gdDoxODiI8fFx\/Prrr6pBk797IyCgqV1dXQA+N4Do6+uj9R88z8Pr9SIWi6nK 6HAchxs3bsBisdDgaWdnB7u7u\/j3f\/932r9XKxoDQVwQRRFutxtOpxOSJCGZTNY0EYuLixWZLy1g woVCAeFwGHa7HYFAAHt7ewiFQtja2sLo6Cj8fn\/NmZx0Ok1dM1IeUUua+8qVK4jFYlheXtZ8bnGY kskklpaWYDQaqewvX76M58+f13xBvrw3HeFxVhxT\/ixW3tbWBpfLhVQqhXv37tHgzOPx4ObNm+jq 6sLi4uKpE0tWyYODA7S1tWFychIWiwW5XA5+vx+CICAUCtHGC1rcBNIB0mQyYWBgABzHYWVlBQcH BzUdJJHmfrW4ZSzLYnFxEV6vF36\/HxzHYXd3FzabDf39\/TW5MiRdWx6g19IbgWVZZDIZFAoFOJ1O XL16FQaDAUajEfl8XpPsyfeSg9N8Po\/Z2VncuXMHfX19CIVCWF1d1bTrke++dOkS+vr6aIo7mUxi YWHh2+0EHo8HkiRhbW0NqVSK4tPs7OwgHo\/DarXC5XKdemBDFOTt27fgOA5+vx83btyg\/w+Hw3j5 8uWxIFPViJwyX7lypWLMJP2qte0RUXq1ZcLVxpRIJPDw4UNcvXoVXq8XXq8XwOcOjrX0Az7OPVQU hXb11KJkpFH7lStXcOnSJQCfwb1IH2strXHLv1+n02F7e5smJi5evIhoNKrJsAgwWHt7e4WRhUIh LCwsnCl1WrMRkIh\/fX0d2WyWpgxJo7+HDx9Cp9NR5DA1kyCKIp49e4aFhQXY7XZwHIdUKoVoNKra AIiPPDMzU7EiKoqCZDKJcDhMV061BqAoCt68eQODwaDqwO40uYXDYdy7dw9NTU0wm83IZDIIhUK0 Va7aXsfZbBa\/\/vorjXHI6hiNRnH37l16gqy6WQXPY21tDeFwGC6XCwzDIBaLIZlMqg5meZ7H\/v4+ fvnll4oDMY7j8O7dO3pQqbYhH9Gnp0+fHtuUhcR2Z3HbajYChmGQTqcrQGXL\/5fJZKjCqB0gechE IoFYLEZ5acGvJ0r76dOnihW73H+spfkdqXevtVHGYUVRFIXukGRchUJB9YpLLt4cHBwccYEIEG4t \/jLP80cas2jJ5pSD5ZZ\/P1HmRCJBx6tFcVOp1LE78DeNCciDVVOIswysHk0b6p2Gqze\/4woNta5m 1RSgGgTi15J\/te8\/y7jq2fTkiB5\/zVTU12wR2qCG\/L+IEZSnpWqZgOOyRLXyqja2WngdDnbPEmR9 DV4N+auXWV3dIZZlkc\/nsbW1hZGREU1wGCTo3draosGboijY3NxER0eHpoGT4Htzc5PGIyzLYnt7 G319fdDr9apz7cSd+PTpE\/XFSbfNg4MDemVQC6+dnR3amILEN6FQCB0dHZpkRlqckvLqhvxrk7+q z5L+BGreTB56aGgIzc3NqtEOZFmm3eGJb0eqHQOBADwej6qJIO\/Z3d3F8vJyxaooSRK8Xi96enpU IxSwLItIJIL5+XmKm094uVwuDA4OakKISKfTmJubQzabpc8pyzJMJhOGh4dhsVg0IScsLCzQhhkN +dcmfxX0SJMREOGpTW8d3t4OB0W18CKfO+5iDCkr1jq243jJsnykUbgaXsdln8gholZe5LZZQ\/5n k\/9pRqA5VK9nK9B6txWtV2vXemWo1GTRGvL\/8vL\/rrJDDWrQuc8ONahBDSNoUIMaRtCgBjWMoEEN ahhBgxr0r0YVOa1a8tnVqFr+9\/B7GucE1Xn9yOcEh6leCBrHyYIv\/xKTyYTBwUHY7faaL46QU8Vg MIjl5WUKu3fcYEqlEgYGBmo+sSSvkfFrPbEktffVTiwHBgag1+u\/yYlxoVDA4uLisSfGo6OjcLlc mnodVDsx\/h7lf1hPZFmG3++nt\/HOopvZbBZLS0uIx+NUrjwRrtlsxh\/\/+Ee0tLRoat9T7ct6enrg crnw7NmzqpY9MjKCqakpze2Cent7wXEc5ubmIAgCnYDp6WkIgqCpdqW3txdms5mOkyC7TU9P11S7 0tzcjHv37lVghN65c6em2iGPx4O7d+8ilUrRyb927VpNtUN+vx\/379+nUC\/fq\/yP05MLFy5gYmKC GsWZ\/H+WRXd3N+7fv08bg\/DE0gKBAFpaWjTjap70ZYFAAMvLyxVdSMq3ep\/PB1mWNSM\/EAxOcq1O URR4vV4IgqD5Ij7Hcejs7MSbN28oWkNbWxtsNptmWTAMQ1E2QqEQAMDhcKC1tRX5fF7TBIqiCJvN hra2NnpBxmAwoLOzk8K1aCG9Xo\/Ozk6KIvG9yr98NyCX\/4eGhijIbz3IbDZjaGgIoVDosyzIxJjN 5pqQDqoR8aeNRuOJk1+LZVe7YVQrr8N+7FnuEX8NXrU+ZzV343uTf7kO6fV6TbuLGiKuPwEpYMsH 0qB\/bWrM8VHjO5Id+lcisnIcvoRS7XW1VO6L14LLU77yHYaOJ3y1FNtVU+xa8UyP+\/5qr5\/G57jP lD9nvW66qYlpTuojwWudQOKL1rMy8nBastpDqK1SJG4YgR4hSkf6gJHujVr8ajI2i8UCs9kMSZIo aLCWSkxyUV8UxYoULMMwtHZeK1TKcds9gZTXQgQM+LBvTvCB1I6rHE9IFEX6jOX4SESXzro7SZJE EchPWhCKxWLVdDCv1QBGRkbgcrnw8uVLZDKZupXiklanHR0dFYZAFDiXy+HDhw+nTgQRxOXLl9Ha 2or19XW8fv0apVIJXq8XExMTyOfzePjwIYUpUWMABoMBFy9epFCJpVIJiUQC79+\/x9bW1qkGSpR7 cHAQfX19WFtbo6jUoihieHgYg4OD2NrawszMzKlylWUZVqsVN27coIZNKJvNYnV1Faurq6qej7Rg vXnzJqxWKxYWFjA3N\/c5c8LzuH37NgwGA\/75z38inU5XfVaSDid8SC+CcDhMAYwnJyfhcrkAfEb4 Jvi1tepMb28vLly4QOV1GGGE\/J3JZPDo0aNjeyzwarcbRVFw9epVtLW14eDgAD\/99BMePXqEVCpV F0NQFAUOhwM+n69iokleO5vN4uPHj6p2AUmS8OnTJ\/h8PqpY0WgUY2NjMJvNmJubU23A5DDn5s2b aGtrQyqVwurqKiwWC7xeL27duoWHDx9iZ2fnRH5kQuLxOEwmE\/x+Pz5+\/EixeTo7O2EymRCPx1Wt jiTQdTqdYFkWe3t7dFVsaWlBS0sLMpkMgsGg6h3UbDbDbDbj4sWL2N3dRSKRAM\/zMJvNMJlMqt0X wgf4DMQbCoUgyzLsdju8Xi81zLPcPygUCujq6sL4+LiqewcGgwEWiwWZTObobqrWAK5fvw6Px4NH jx7h0aNHiEQi+OMf\/wiHw1EzSO5hN2FxcRE\/\/\/wzfv75Z\/zXf\/0XZmZmqMuyurqKYrGoaiJIe6EP Hz6AZVlcunQJo6OjcDgc2NzcxNLSkuoJEEUR3d3daGtrQywWwy+\/\/IIXL17g\/v37ePfuHViWxcDA gKrsCMdxCIfDSKfTMJvNaGpqoqlQp9OJYrFI7xRrWTxEUcQ\/\/\/lP\/PLLL\/j555+xubkJ4DM0upas CnmvTqfD6OhoxetaXMfy7\/R4PNDpdJAkCW63m2ZkzhKoFwoFdHZ24vr161RWmUwGDx48QDgcBvC5 u9GDBw+QTqdPjZ\/Y07ZchmFw69YtOBwO2iqH53m8fPkS6+vrmJ6eRnNzc80oz+UrZT6fRzKZRDQa BcMwGB4eBsdxWF9fpwqndjUSBAFzc3PY29uD2+3GyMgI0uk0ZmdnNQXFBM8UAFZWVpBKpWjabnFx Effu3aPwkWp4FQoFBINBMAwDt9sNSZLQ1tYGnucRCoWQTqc1x1oMw6ClpQWtra3weDywWq1Ip9Oa DYr4zvF4HD6fD11dXTXNK3nORCIBh8OBpqYmAEBHRwdEUdTU3ec4F8jr9eLmzZsVsYder4fBYMDz 58\/x6dMnPH\/+HDqdThW0JXvSdisIAj2pu3v3LjKZDM2IsCyLmZkZvHv3DhMTE2htbdV8gFMto2Ey mXD79m3YbDaEw2E8f\/5cczaBZVkUi0XMzc3R11ZWVpBIJDRhagqCQLf2chBfElxvb2\/TgzG149vZ 2aGrpNFopD3atre3a6pX4nke09PT+Otf\/4o\/\/elPcDqdiEQimpG3SYnF27dvUSwWMTo6CqPRWNO8 SpJEdyTSsK+5uRn7+\/s1GwFpd3X79u0jYL48z2NychJNTU24f\/8+HA4HpqamVLm87EluQE9PDzwe Dz59+gSn01lx8MUwDNra2hCPx5FKpTA+Pl6x1Z0l1TU+Pg6Xy4VsNotnz55p6lx5WDkCgQB9zefz wWw2a5pUciJK3JnyrZxhGDQ3N6OpqUm14nIch0gkgmw2C7vdTjt1SpJ05GRdS+ZqZmYGT548wZMn T7C\/v4+uri6Mjo5qVmCe52k9j81mw8jISE1zyvM87TTZ3t5O6362trZqXixZlkUul6tqRNFoFPF4 nDaNiUQi6vie5r8Gg0H09PTg+vXrGBwcrOiQePv2bYyMjIBhGCwvL58JNIlkTy5fvgy\/3w9RFPHk yRNa6KR1IorFIgKBAHw+H2KxGEKhEJxOJy5duqSptkUURYqLStwXRVFQKBTQ3NyMP\/\/5z5icnKww ltMmkrQ2JfGKwWBAMBis2RVSFAWrq6tYXl7G3Nwc3r9\/T3eak1KHJ6Wi5+bmkEgk0NfXp6mGqvw5 M5kMdnd30dTUhJGREYiiqClQP45nOp3G48ePjzSGJK83Nzfjr3\/9K5qbm\/H48WOKqVqzEcTjcTx9 +hSPHz\/G27dvaWpQlmXaM+DBgwd4\/PgxlpaWznRuIMsyBgYGMDw8TFGgw+EwTCYTBEHQlIGSJAkO h4MGd69fv8aLFy9o+1Sv16spmCfVsIFAACMjI9DpdGhpacHo6CgEQUA4HFadbiW0vb0NALRZ4c7O Ts2lAQzDwOVyweVy0VUXgOp+atV8+jdv3mg+vDucDdva2qJ1T3t7e0ilUmfSE47jkMvl8PTp0wrI f4PBgKtXr+LatWsQBIH+rqYtF3+aMMiAS6USDAYDTCYTSqUSLBYLfc9ZoTbIIdbw8DANWoeHh3Hh woUK9+zBgwe0D8Jpfvzk5CT0ej2Wl5ext7eHUqmEpaUlDA8PY2JiAslkUhU+PglYZ2dnMTY2hvHx cVy5coW6Z3t7e5ibm9PcYywajSKfz8NgMEAURc1BLFE0EqP9+c9\/rvhfLpfDx48fq5ayV9sBSG2\/ IAjY3t7G+vo6uru7VXeSL+dDYNrJc5KYpxypulZXK5\/P4+nTp7hx4wba29tpZ6RyYyn\/myy0mo2g fNKSySQt5VUUBQaDAWtra3U9NY7FYvQktZwvOcVUEzSWSiUYjUZEo1Hs7e3RAyOGYTA3N4disQi9 Xg+TyXRszriaohE0OL\/fD7vdDkmSEAwGsb6+rjlm4TgOxWIRs7OzsNlsSKfTyOVymrvwFAoFvHv3 ruK7Sc383t6e6m48xKUiB2TFYhEcx0FRFLx9+5ZC8J+WoiaBNeFDWiu9evUKNpsNwWAQOp0OGxsb SCaTtJ9dLTtguSH09vaeeFeDYRiaKDhunlQbQS6Xw+PHj6lQyZF3PQCSCHb948ePTxSwmlIN4ou+ evWKCouMUZIk6i+rbYZRvrqFw2GEQiG6gpGT1lpkwDAMVlZWqMFrPXAsN4JqhqalzKRUKmF+fp7u pMT4c7kcdYtO681wHB\/S+KP8742NDaytrdHdotb0OunpQOZUTdr8TGUTRCjlBWj1rh2qJ0rbcf2w qr2uZfWpJ531pP2sz6NmPCzLav6Ow3wO\/11POdajho0\/nKNXm8vXmvv\/Erwb1KCzLCDUkEggWq9b O8dlar6E0h\/+7PfE6\/BFmH\/V5\/xSvA7HKvW+B0FiF+rqkkna2trC4OAgBEE488kv8Ln+JBqNVlwU P\/xwqVQKXq9Xc2Ck0+mQSqUq+qWR01GtF7F1Oh1isRgN+liWpf2xSG8xLT4qaXdKJpa0RTUYDJrk SuIOklIkJQ2ZTAZWq1VTipe4sslk8ruX\/2EZpNNphEIh9Pb21uXqL4nvtra26Pi5oaGhv7Ms60+l Ukin03A4HNT3r+WHXJoIhUL4\/fffT8wLkzav5CRaLe9gMIiXL19WdGxMJBLQ6\/W0hFfNWMkYXrx4 QS+zsyyLg4MDlEolOJ1OmsJVM7ZcLoeXL19if3+fNvnO5\/PIZrNwuVw0AaCGFwniV1ZWaNqSNCFv amqCTqejdxxO4yXLMlZWVmgASZTte5T\/cYsl6expMplUz0e18ZNAen5+nox9s6I\/gSiKtIHzWSxN URRkMhlIknRiEERKpc1ms6qccTnv8jJrIhhyfqH2hJl02SwWi0eAAGRZhsViUX3iSgoAc7nckWeW JAlGoxEGg0E1L1EUj+3+KUkSdDodzGazal6SJCGdTh9JZnyv8j9OTxiGgcViOTPkSqFQQCaTKcc6 Otqko9xKz2IIais+yaqhtV1QNd5abyudlF2oJy+tcj2pNWk9eX3P8j8rb5Xfd7RJx5e4NlnrBNWa O\/4eedVTrvVu+vG9yuxr8W5gkTboh6eGETSoYQQNETSoYQQNalDDCBrUoB+bKrJDsizXhDH\/tala hWQ9QVsbdLL8j8vUnFf9ob+JogiLxYJAIKD6UOdbkCzLWF9fRyQSqahOJLfdSH+FBn0ZyuVyWF5e PgLCdZ71hyf\/aGpqwn\/8x3\/QWpLv8SFInVMqlcJ\/\/ud\/YnV1FTqdjqIX\/\/TTTxTBrlGRWn8igF+9 vb347bffEIvFwPP8udcfnoA3jY2Nwefzqbpt9a3JbrdjamoKq6urAD6XEgwNDaGjo0MzPn6DtJPD 4cDw8DAePXpEd4Hzqj+KonzuT8AwDEwm07nxpwncYHkdyVlaTDVIu\/ytViuV\/3nXH7Z8qztvW\/NJ fzfoy8u\/XObnWX8aKdIG\/fDE1sOitARCx72v0SmnQefWCEidt9FopNich42j\/G\/y\/vJmH+S18itv Dfqx3Sxy1vC1qOZr\/4qiwGq1IhAIUOjtjY0NRCIRKIoCm82Gzs5OrK+vI5\/Pg+M4+P1+tLS0oFgs YmtrC5FIBO3t7RT1eXd3F3t7e+c6vXm4tREJHMluV14CfVrrpmqtpr5mqXu9FZzIorx7DfB\/cC06 nQ4ulwuxWAz5fP7UO9qHP09+\/+I7AZnM\/v5+8DyPhYUF2mnGaDSis7MTg4OD9EqhLMvo7OxER0cH 9vf3IYoi+vr64PF40NfXh1gshkgkgp6eHjidznO5I5CLLiaTCQaDga5m5Eolz\/PQ6\/X0YghpXm0y mWiunWQuOI6jt\/vI+yVJgl6vr+Bx7tyOMlmQnZ9gDxH5mc1mdHd30+evBlpAFgrCi8haK\/bqmXYC lmURi8WQSCQQjUbh9Xpp7yiHw0EVgwB02Ww2RKNRLC0toampiXaN2d7exsbGBkwmE9xu95muz31L A9DpdLh27RrtHLO7u0th61mWhc1mg9FoxOLiIt68eYPOzk5cvnyZXmucn5\/H4uIiuru7cfnyZRgM BsTjcbx8+RKJRAJXrlxBd3c3hZMkkPPnYdckvd56enqQTqfhcrmwsLAAq9UKj8dDO+2Ew2Haqcjn 88Fut8NkMmF1dRWFQgH9\/f04ODgAy7KwWCxUdrlcDkajETzPw2KxIBQKYW1t7cvuBOVIyPF4nJYq bG5u4uDggPbxKr+G9+nTJywtLcFkMsHn86FQKGBjYwOLi4tob2\/HpUuXUCwWNfUP+F5IkiR0dHTA 7\/djbm4Oz58\/p6t5U1MTmpqa8Pz5c8zNzeHChQvw+Xxwu93Y29vD\/\/zP\/yCfz6O\/vx9OpxPXr19H OBzGvXv3IAgCBgYG0N\/fj\/7+fjx79gzv37\/H6OgovF7vucnLk4XQarXCbrdjbW0NVqsVPp8P6+vr WF1dRWdnJ+x2O+3dsLu7i2KxSAGLgc9toPR6PXWZRFHE9vY2TCYTHA4Htra2EAwG0d7eThs3fhEj KA9qGYaB1WpFa2sr1tbWsLOzQy+GH16hMpkMTCYTRkdHodPpaP8xm82GeDyOtbU16HS6I437zgMR 0N7d3V1cunQJFy5cQCKRQDabBcdxWFtbw+bmJhYWFpDNZtHS0oJPnz6BZVlcu3YNFosFoiiipaUF LMvSDjt3797Fq1ev4Ha7KSo26WhPkDDOG21sbGBrawtmsxkMw6C1tRWtra0UIzabzQL4DLVOOo+W J2JIPFEoFLC8vExh8wk0SyKRoFAqaj0KzS1cSQucXC5H\/bjt7W3E43G6gh82AEVR0NTUhMHBQUQi EayurkIURfT29sLlcuHVq1cIBoO0icZ59Hd1Oh1WV1cRi8XQ3d2Nq1evQpIkFItF6t8KgkAXiTt3 7iCRSOD58+eYmJiAyWSiECYEo6izs7MC2Ja0mnK73YjFYucyQCZxAIGL2djYoP0uCApEuQ6VJxgO F0yWt\/Ulu00tMuG1PkBzczO6urrw4cMHRKNRWK1WdHZ2IpVKVYAjlQcwDMOgq6sLHMfB4XDgypUr YBiGgtuOjY3RgIn08zpvE2s2mzE1NYWlpSVwHAdRFCk0idfrxZ07d+B0OlEqlbCxsQGv1wuj0Yje 3l60tbXRpn2hUAjXr1+H3+9HIBCgGDlutxsXL14EwzBoamrCw4cPz5WMypWaZVns7+\/D5XLB5\/NB FEU4nU7Mz89TFy8QCCAUCoFhGPT390MURdpnmYB8ESpXfi1IJ\/TzAwMDf1cUxT8wMICOjo5TMzOK oiCXy1EEslKphHw+T\/8mrhB5H+keKMsykskk0uk0\/YlEIrTHbaFQwPr6elX47IpB\/y+a2tu3b+l3 +Xw+NDc3f5PMEhlPNBqFw+FAqVTC27dvEQ6HceHCBezt7SGZTEKSJMzOziIcDiMej9OmJ2Rbj8Vi 2NnZoUC7CwsLWF5eRiaTQTgchtVqhSRJePfu3TeNnQjy98rKCs3ynKQ\/JHtD9KRUKtH4jzTR2N7e RiqVgizLyOVyKJVKiEajFNkumUzSzp\/ZbJbC2ROMJrIIk0CZwMkfZwzl+gNgk9f68NlslqKFEeju wyBRpPl2ec35\/v7+ETeH+G2kGvRLIF1\/TcXY3d2lgR1xkQj0+Js3b2jTbZ1Oh0gkQhv+ERIEAcVi sQIpjuM4CIJQ8f7DK+F52AWKxeKRmDGbzWJlZaXiWQEgFApR9yabzSISiVToVrn7wzAMotEo1adC oYDd3d0joGV1TZGW+2HH\/V3t9WqT9q9U939YDqSjO0nhlRt4tdtZ1TCFqr3\/PBnCYfmc9Kyn6U21 91fTxy9yTtAgdbS9vX3uVu4fjRpG8IXprI04GvQVXNnz6pYcPk5v0NeX\/3meg4omHcQnI10hz8PD CIKATCZTEf3H4\/GGMXxF+ScSiYr2sOdZf3gSSLx+\/Rp+vx89PT3fvQXv7e1VNPnjeR6rq6twu93o 7u5uaOkXplAohI8fP9Kg9jzrD8uyoNDskiRBEAT4\/X5Yrdbv9iHy+Tw2NzeRTqcr\/G3SBdLn81XU mzSovpTL5bCxsYFCoVAR7J9j\/XnEk+CYHGUvLS1917U7ZOc6HHCSisLl5eXGLbWvIP\/D2a5zrD88 DyD9vz9iLe06v7cHPM\/jP\/dZlvOnPwKANA\/gdwAHABqAPQ360UgP4OP\/HwC8HtTGKYk\/rQAAAABJ RU5ErkJggg==\" \/><\/g>",

          "comment": "<g><path fill=\"#FFF200\" stroke=\"#000000\" stroke-miterlimit=\"10\" d=\"M340.333,121.363c0,7.531-6.968,13.637-15.562,13.637H115.561   c-8.594,0-15.561-6.105-15.561-13.637v-31.06c0-7.531,6.967-13.637,15.561-13.637h209.211c8.594,0,15.562,6.105,15.562,13.637   V121.363z\" \/><text transform=\"matrix(1 0 0 1 115 96)\" font-family=\"\'MyriadPro-Regular\'\" font-size=\"12\" templated=\"0\">A Note<\/text><\/g>"
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