
var map;
var basic_path;
var major_paths = [];
var pathObjs = [];
var majorNodes = [];
var eventNodes = [];
var showingEventNodes = false;
/* draw eventNodes with zoom level is...*/
var eventDrawThreshold = 19;

/* params */
var utm_zone = 59;
var speed_s = 10.0;      // in m/s
var hertz = 5.0;         // samples per second
var events_per_boom = 5; // event sentences per boom sentence 
var speed_t = speed_s/hertz;
var f_error = 0.1;
var r_error = 0.05;
var ms_knots = 1.94384449;
var boom_count = 1;
var start_time = new Date();

/* output controls */
var go_timer = 0;
var going = false; //die
var idling = true; //die
var outputting = false;
var driving = false;
var current_event = [0,0,0]; // major node, event node, tick count
var path_mode = true;

var selected_node = null;
var moving_component = null;
var vehicle;
var boom_sentence = "$TMAAA,N,N,N,N,N,N,N,N\r\n";
var gps_sim_boom_sentence = "booms N,N,N,N,N,N,N\n";

/* z_indices */
var vehicle_z = 7;
var major_z = 2;
var basic_z = 3;
var path_z = 5;
var event_z = 9;
var boom_z = 1

/**************************************************************************/

function distance(p1,p2){
    return Math.sqrt((p1[0]-p2[0])*(p1[0]-p2[0]) + (p1[1]-p2[1])*(p1[1]-p2[1]));
}

function get_vector(p1,p2){
    return [p2[0]-p1[0],p2[1]-p1[1]];
}

/* TODO handle for lengths < 1 */
function unit_vector(v){
    if(v[0]==0 && v[1]==0){
        return v;
    }
    return [v[0]/(Math.abs(v[0])+Math.abs(v[1])),v[1]/(Math.abs(v[0])+
                                                       Math.abs(v[1]))];
}

function get_normal(v){
    return [v[1],-v[0]];
}

function get_gaussian(mean, sd){
    var rand1 = Math.random();
    var rand2 = Math.random();
    var r = Math.sqrt(-2.0 * Math.log(rand1));
    var theta = 2.0 * Math.PI * rand2;
    return mean + sd * r * Math.sin(theta);	
}

function add_noise(pos, error){
    return [pos[0]+get_gaussian(0,error), pos[1]+get_gaussian(0,error)];
}

function add_noise_dual_variance(pos,dir_unit,error,normal_error){
    var out = [pos[0],pos[1]];
    norm = get_normal(dir_unit);					       
    out[0] += get_gaussian(0,error)*dir_unit[0];
    out[1] += get_gaussian(0,error)*dir_unit[1];
    out[0] += get_gaussian(0,normal_error)*norm[0];
    out[1] += get_gaussian(0,normal_error)*norm[1];	
    return out;
}

function traverse_vector(p1,p2,dist){
    var vector = [p2[0]-p1[0],p2[1]-p1[1]];
    var mag = dist/distance(p1,p2);
    return [p1[0]+vector[0]*mag,p1[1]+vector[1]*mag];
}

function vector_rad_to_deg(pos){
    return [RadToDeg(pos[0]),RadToDeg(pos[1])];
}

function vector_deg_to_rad(pos){
    return [DegToRad(pos[0]),DegToRad(pos[1])];
}

function mid_point(p0,p1){
    return new google.maps.LatLng( (p0.lat()+p1.lat())/2.0, (p0.lng()+p1.lng())/2.0);
}

function cubic_bezier(p0, p1, p2, p3, n){
    pts = [];
    for(var i=0;i<n;i++){
        var t = i/(n-1);
        a = Math.pow(1.0 - t,3);
        b = 3.0 * t * Math.pow(1.0 - t, 2);
        c = 3.0 * Math.pow(t,2) * (1.0 - t);
        d = Math.pow(t,3);
        x = (a * p0.lat() + b * p1.lat() + c * p2.lat() + d * p3.lat());
        y = (a * p0.lng() + b * p1.lng() + c * p2.lng() + d * p3.lng());
        pts.push(new google.maps.LatLng(x,y));
    }
    return pts;

}

/**************************************************************************/

function add_meters_to_latLng(x_m, y_m, latLng){
    var utm = [0,0];
    LatLonToUTMXY(DegToRad(latLng.lat()), DegToRad(latLng.lng()), utm_zone, utm);
    utm[0] += x_m;
    utm[1] += y_m;
    var lat_lng_out = [0,0];
    UTMXYToLatLon(utm[0], utm[1], utm_zone, true, lat_lng_out);
    return new google.maps.LatLng(RadToDeg(lat_lng_out[0]), RadToDeg(lat_lng_out[1]));	
}

function create_bounds(size, latLng){
    return new google.maps.LatLngBounds(add_meters_to_latLng(-size, -size, latLng), 
                                        add_meters_to_latLng(size, size, latLng));
}

function create_rhombus(size, latLng){
    return [add_meters_to_latLng(-size, 0, latLng),
            add_meters_to_latLng(0, size, latLng),
            add_meters_to_latLng(size, 0, latLng),
            add_meters_to_latLng(0, -size, latLng)]
        }

function nmea_format_time(time){
    return (zeroPad(time.getUTCHours(),2).toString() 
            + zeroPad(time.getUTCMinutes(),2).toString() 
            + zeroPad(time.getUTCSeconds(),2) + '.'
            + zeroPad((time.getUTCMilliseconds()),3).substring(0,2));
}
 
function nmea_format_latlng(latLng){
        var lat = Math.abs(latLng.lat());
        var minutes = (lat % 1) * 60.0;	
        lat = ((zeroPad(Math.floor(lat),2).toString() +  
                zeroPad(Math.floor(minutes),2).toString()) +
               (minutes % 1).toString().substring(1,7));
        var lng = Math.abs(latLng.lng());
        minutes = (lng % 1) * 60.0;	
        lng = ((zeroPad(Math.floor(lng),3).toString() +  
                zeroPad(Math.floor(minutes),2).toString()) +
               (minutes % 1).toString().substring(1,7));		
		
        lat += (latLng.lat() >= 0.0) ? ',N,' : ',S,';
        lng += (latLng.lng() >= 0.0) ? ',E,' : ',W,';
        return lat+lng;
}

function nmea_format_date(time){
    return (zeroPad(time.getUTCDay(),2).toString() +
            zeroPad(time.getUTCMonth(),2).toString() +
            zeroPad(time.getUTCFullYear().toString().substring(2),2).toString());
}


/**************************************************************************/

/* For binding a reference to 'this', so that object methods called
   from callbacks have a reference to themselves */
function bind(scope, fn){
    return function () {
        fn.apply(scope, arguments);
    };
}

/* used for equality tests on DOM elements retrieved with selectors */
$.fn.equals = function(compareTo) {
    if (!compareTo || this.length != compareTo.length) {
	return false;
    }
    for (var i = 0; i < this.length; ++i) {
	if (this[i] !== compareTo[i]) {
	    return false;
	}
    }
    return true;
};

function form_post (to,p) {
  var myForm = document.createElement("form");
  myForm.method="post" ;
  myForm.action = to ;
  for (var k in p) {
    var myInput = document.createElement("input") ;
    myInput.setAttribute("name", k) ;
    myInput.setAttribute("value", p[k]);
    myForm.appendChild(myInput) ;
  }
  document.body.appendChild(myForm) ;
  myForm.submit() ;
  document.body.removeChild(myForm) ;
}

function zeroPad(n, digits) {
    n = n.toString();
    while (n.length < digits) {
        n = '0' + n;
    }
    return n;
}

/**************************************************************************/

/* Draggable base class.  Must bind callbacks to actually drag */
function Draggable(_latLng){
    this.latLng = _latLng;
    this.shape;
    this.size;
    this.moving = false;

	
    this.mouse_up = function(){
        if(this.moving){
            this.finalize_move();
        }
        this.moving = false;
        /* kludge ... consider another to figure this out */
        if(moving_component != null && moving_component != this){
            moving_component.mouse_up();
        }
        moving_component = null;
        return true;
    }

    this.mouse_down = function(){
        moving_component = this;
        this.moving = true;
    }
	
    this.remove = function(){
        return;
    }

    this.mouse_move = function(event){ 
        if(this.moving){
            this.move(event);
        }		       
    }

    this.move = function(event) {
        return;
    }

    this.finalize_move = function(){
        return;
    }
	
    this.get_pos = function(){
        return this.latLng;
    }
	
    this.draw = function(){
        if(typeof this.shape.setMap == 'function'){
            this.shape.setMap(map);
        }		
    }

    this.undraw = function(){
        if(typeof this.shape.setMap == 'function'){
            this.shape.setMap(null);
        }
    }
	
    this.show = function(){
        if(typeof this.shape.getVisible == 'function'){
            this.shape.setVisible(true);
        }
    }

    this.hide = function(){
        if(typeof this.shape.getVisible == 'function'){
            this.shape.setVisible(false);
        }
    }	
	
}

function Boom(latLng, position,on){
    this.latLng = latLng;
    this.position = position;
    this.radius = 7 + position;
    this.on = on;
    this.on_colour = '#00FF00';
    this.off_colour = '#FF0000';
    var boom_attr = {center:this.latLng, strokeColor: '#00FF00',
                     strokeOpacity : 1.0, strokeWeight: 3, radius:this.radius,
                     fillOpacity: 0.0, 
                     zIndex: boom_z };
    this.circle = new google.maps.Circle(boom_attr);
    if(!this.on){
        this.on = false;
        this.circle.setOptions({strokeColor:this.off_colour});
    }
    this.draw = function(){
        this.circle.setMap(map);
    }
    this.undraw = function(){
        this.circle.setMap(null);        
    }
    this.move = function(latLng){
        this.latLng = latLng;
        this.circle.setCenter(latLng);
    }
    this.turn_on = function(){
        this.on = true;
        this.circle.setOptions({strokeColor:this.on_colour});
    }  
    this.turn_off = function(){
        this.off = false;
        this.circle.setOptions({strokeColor:this.off_colour});
    }
    this.set_state = function(state){
        this.on = state;
        if(state){
            this.turn_on();
        }
        else{
            this.turn_off();
        }
    }
    this.get_word = function(){
        if(this.on){
            return 'T,';
        }
        else{
            return 'F,';
        }
    }
}

MajorNode.prototype = new Draggable();
MajorNode.prototype.constructor = MajorNode;
function MajorNode(latLng){
    this.latLng = latLng;
    this.size = 6;
    this.colour = "#0000FF";
    this.opacity = 0.3;
    this.sel_colour = "#0000FF";
    this.sel_opacity = 0.8;
    this.has_moved = false;
    this.has_booms = false;
    this.booms = [];
    var attr = {center:this.latLng, strokeColor: this.colour,
                strokeOpacity : 0.8, strokeWeight: 1, radius:this.size,
                fillColor: this.colour, fillOpacity: this.opacity, 
                zIndex: major_z }
    this.shape = new google.maps.Circle(attr);
	
    this.remove = function(){	
        if(path_mode){
            this.undraw();
            if(this.has_booms){
                for(var i=0;i<this.booms.length;i++){
                    this.booms[i].setMap(null);
                }
            }
            var i = majorNodes.indexOf(this);
            majorNodes.splice(i,1);			
            splice_out_major_path(i);
            draw_major_path(i-1,i);
            splice_out_path(i);	
            drawPath(i-1,i);
            fix_events();	
            return false;
        }
    }

    this.move = function(event){
        if(path_mode){      
            this.shape.setCenter(event.latLng);	
            this.latLng = event.latLng;
            var i = majorNodes.indexOf(this);
            if(i-1 >= 0){
                major_paths[i-1].set_path([majorNodes[i-1].get_pos(),majorNodes[i].get_pos()]);
            }
            if(i+1 < majorNodes.length){
                major_paths[i].set_path([majorNodes[i].get_pos(),majorNodes[i+1].get_pos()]);
            }
            this.has_moved = true;
            if(this.has_booms){
                for(var i=0;i<boom_count;i++){
                    this.booms[i].move(event.latLng);
                }
            }
        }
    }

    this.finalize_move = function(){
        if(path_mode && this.has_moved){
            var i = majorNodes.indexOf(this);
            splice_out_path(i);
            drawPath(i-1,i);
            drawPath(i,i+1);
            fix_events();
            this.has_moved = false;
        }
    }
    
    var splice_out_major_path = function(i){
        if(major_paths[i]){
            major_paths[i].undraw();
            major_paths.splice(i,1);
        }
        if(major_paths[i-1]){
            major_paths[i-1].undraw();
            major_paths.splice(i-1,1);
        }
    }

    var splice_out_path = function(i){
        if(pathObjs[i]){
            pathObjs[i].setMap(null);
            pathObjs.splice(i,1);  
            eventNodes[i].forEach( function(node){ 
                    node.undraw();
                    });	 
            eventNodes.splice(i,1); 
        }
        if(pathObjs[i-1]){
            pathObjs[i-1].setMap(null);
            pathObjs.splice(i-1,1);
           eventNodes[i-1].forEach( function(node){ 
                    node.undraw(); 						
                    });	 
            eventNodes.splice(i-1,1); 
        }
    }

    this.select = function(){
        selected_node = this; //?
        this.shape.setOptions({fillColor:this.sel_colour, fillOpacity: this.sel_opacity});
    }

    this.deselect = function(){
        selected_node = null;
        this.shape.setOptions({fillColor:this.colour, fillOpacity: this.opacity});
    }
   
    this.create_booms = function(default_state){
        for(var i=0;i<boom_count;i++){
            var new_boom = new Boom(this.latLng, i, default_state);
            new_boom.draw();
            this.booms.push(new_boom);
        }
        this.has_booms = true;
        create_boom_box();
    }
    this.on_click = function(event){
        /* like convoluted nested logic?  You have come to the right place! */
        if(!path_mode){
            /* nothing selected */
            if(selected_node == null){
                this.select();
            }
            /* something else selected */
            else if(selected_node != this){
                selected_node.deselect();
                this.select();         
            }
            /* this is selected, do stuff */
            else{
                if(!this.has_booms){
                    /* this is a special case, where we will try to 
                       guess the appropriate booms */
                    this.create_booms(true);
                    var set_to_off = false;                   
                    var i = majorNodes.indexOf(this)-1;
                    for(;i>=0 && !majorNodes[i].has_booms;i--);
                    /* if this is first, do nothing */
                    if(i < 0 || !majorNodes[i].has_booms){
                        return;
                    }
                    /* if it has any on, we will turn all off */
                    if(majorNodes[i].any_booms_on()){
                        for(var j=0;j<this.booms.length;j++){
                            this.booms[j].set_state(false);
                        }
                    }
                    /* else, if all off, find the one before it and copy it */
                    else{
                        for(--i;i>=0 && (!majorNodes[i].has_booms || !majorNodes[i].any_booms_on());i--);
                        if(i < 0 || !majorNodes[i].has_booms){
                            return;
                        }                      
                         for(var j=0;j<majorNodes[i].booms.length && j<this.booms.length ;j++){
                            this.booms[j].set_state(majorNodes[i].booms[j].on);
                        }                       
                    }                    
                }
                else{
                    this.has_booms = false;
                    for(var i=0;i<this.booms.length;i++){
                        this.booms[i].undraw();
                    }
                    this.booms = [];
                }
            }
            if(!this.has_booms){ 
                $('#boom_pane').empty();
                var ctrl = $('<input/>').attr({ type: 'button', name:'add_booms'}).addClass("number_field");
                ctrl.val('Add Booms');
                $('#boom_pane').append(ctrl);
                ctrl.click(bind(this, this.create_booms));
            }
            else{
                create_boom_box();
            }
        }
    }
    
    this.on_dbl_click = function(event){       
        if(path_mode){
            this.remove(event);
        }
        else{          
            /* so that a double click behaves like two clicks */
            this.on_click(event);
        }
    }

    this.set_boom = function(i,state){
        if(this.booms == null || i >=  this.booms.length){
            this.create_booms(false);          
        }
 
        this.booms[i].set_state(state);
    }

    this.any_booms_on = function(){
        for(var i=0;i<this.booms.length;i++){
            if(this.booms[i].on){
                return true;
            }
        }
        return false;
    }

    this.update_boom_sentence = function(){
        if(this.has_booms){
            var result = "$TMAAA,";
            var i;
            for(i=0;i<this.booms.length;i++){
                result+=this.booms[i].get_word();
            }
             for(;i<7;i++){
                 result+='N,';
             }           
            boom_sentence = result+="N\r\n";
            return true;
        }
        return false;
    }

    this.get_gps_sim_booms = function(){     
        var result = "booms ";
        var i;
        for(i=0;i<this.booms.length;i++){
            result+=this.booms[i].get_word();
        }
        for(;i<6;i++){
            result+='N,';
        } 
        return result +"N\r\n";
    }

    google.maps.event.addListener(this.shape, 'dblclick', bind(this, this.on_dbl_click));
    google.maps.event.addListener(this.shape, 'mousedown', bind(this, this.mouse_down));
    google.maps.event.addListener(this.shape, 'mouseup', bind(this, this.mouse_up));
    google.maps.event.addListener(this.shape, 'click', bind(this, this.on_click));
}


EventNode.prototype = new Draggable();
EventNode.prototype.constructor = EventNode;
function EventNode(latLng){
    this.latLng = latLng;
    this.size = 1;
    this.colour = "#00FF00";
    this.path = create_bounds(this.size, this.latLng);
    this.time = 0;
    this.heading = 0;
    this.speed = (speed_s * ms_knots);
    this.has_parent = false;
    var attr = {center:this.latLng, strokeColor: this.colour,
                strokeOpacity : 0.8, strokeWeight: 1, radius:this.size,
                fillColor: this.colour, fillOpacity: 0.3, 
                zIndex: event_z, bounds: this.path }
    var image = new google.maps.MarkerImage('event.png', new google.maps.Size(9,9), 
                                            new google.maps.Point(0,0),
                                            new google.maps.Point(5,5));
			
    this.shape = new google.maps.Marker({position: this.latLng, map: map, icon: image});

    if(map.getZoom() < eventDrawThreshold){
        this.shape.setVisible(false);
    }
	
    this.set_time = function(new_time){
        this.time = new Date(new_time);
    }
    this.set_heading = function(heading){
        this.heading = heading;
    }
    this.set_heading_from = function(from){
                                                               
            var z1 = Math.sin(DegToRad(this.latLng.lng()) - DegToRad(from.lng())) * 
                Math.cos(DegToRad(this.latLng.lat()));
            var z2 = Math.cos(DegToRad(from.lat())) * Math.sin(DegToRad(this.latLng.lat())) - 
                Math.sin(DegToRad(from.lat())) * Math.cos(DegToRad(this.latLng.lat())) * 
                Math.cos(DegToRad(this.latLng.lng()) - DegToRad(from.lng()));
            this.heading = RadToDeg(Math.atan2(z1, z2));
            if(this.heading < 0){
                this.heading += 360;
            }
        }
    /*perhaps should be passed a dict */
    this.get_nmea = function(idle,now){
        var string = 'GPRMC,';
        var latlng = nmea_format_latlng(this.latLng);
        if(now){
            this.time = new Date();
        }
        var time = nmea_format_time(this.time);
        var quality = ',A,';
        var speed = (!idle) ? this.speed.toFixed(2).toString() + ',' : '0.00,';
        var heading = this.heading.toFixed(2)+',';
        var date = nmea_format_date(this.time);
        var magnetic = '0.00,E,';
        var checksum = "A*00\r\n";
        string = (string+time+quality+latlng+speed+heading+date+magnetic+"A");
        var check = 0;		
        for(var i=0;i<string.length;i++){
            check ^= string.charCodeAt(i);
        }
        var result = ('$'+string+"*"+zeroPad(check.toString(16).toUpperCase(),2)+"\r\n");
        return result;
    }
    this.get_gps_sim = function(){
        return "lat " + this.latLng.lat()+ "\r\nlon "+ this.latLng.lng() + "\r\nhead " + 
        this.heading +"\r\nspeed "+(speed_s * 3.6) + "\r\n";
    }
    //google.maps.event.addListener(this.shape, 'click', bind(this, this.get_nmea));		
}

Vehicle.prototype = new Draggable();
Vehicle.prototype.constructor = Vehicle;
function Vehicle(latLng){
    this.latLng = latLng;
    this.size = 3;
    this.colour = "#FF0000";
    this.at_node = [-1,-1];
    var attr = {center:this.latLng, strokeColor: this.colour,
                strokeOpacity : 1.0, strokeWeight: 3, radius:this.size,
                fillColor: this.colour, fillOpacity: 0.5, 
                zIndex: vehicle_z };

    this.shape = new google.maps.Circle(attr);
	
    this.move = function(event){
        this.shape.setCenter(event.latLng);	
        this.latLng = event.latLng;
    };
    this.go_to_start = function(){
        this.at_node = [0,0];
        this.latLng = eventNodes[0][0].latLng;
        this.shape.setCenter(this.latLng);	   
    }
    this.go_to = function(i,j){
        this.at_node = [i,j];
        this.latLng = eventNodes[i][j].latLng;
        this.shape.setCenter(this.latLng);       
    }
    this.fix = function(){
        current_event = [0,0,0];
        if(majorNodes.length < 2 || !outputting){
            this.undraw();
            this.at_node = [-1,-1];
        }
        else{
            this.draw();
            this.go_to_start();
        }
    }
}

MajorPath.prototype = new Draggable();
MajorPath.prototype.constructor = MajorPath;
function MajorPath(path){
    this.start = path[0];
    this.end = path[1];
    this.path = path;
    this.shape = new google.maps.Polyline({path:this.path,
                                           strokeColor: "#FFFF00",
                                           strokeOpacity: 0.7, 
                                           strokeWeight: 7, zIndex : basic_z });
    this.complex = false;
    this.has_moved = false;
    this.temp_shape = new google.maps.Polyline({path:[],
                                                strokeColor: "#FF0000",
                                                strokeOpacity: 1, 
                                                strokeWeight: 2, zIndex : basic_z }); 
    this.set_path = function(path){
        this.path = path;
        this.shape.setPath(path);
        this.start = path[0];
        this.end = path[path.length-1];
    } 
    this.move = function(event){
        if(path_mode){ 
            if(!this.complex){
                this.complex = true;
                this.path.splice(1,0,event.latLng);
                this.temp_shape.setMap(map);
            }
            else{ //don't redo
                this.path = [this.start,event.latLng, this.end];              
            }
            this.has_moved = true;
            this.path[1] = event.latLng;
            this.temp_shape.setPath(cubic_bezier(this.path[0],mid_point(this.path[0],this.path[1]), 
                                                 mid_point(this.path[1],this.path[2]),this.path[2],17));
            this.temp_shape.setMap(map);
            this.shape.setPath(this.path);
            
        }
    }
    this.finalize_move = function(){
        this.temp_shape.setMap(null);
        if(path_mode && this.has_moved){
            var huh = cubic_bezier(this.path[0],mid_point(this.path[0],this.path[1]), 
                                   mid_point(this.path[1],this.path[2]),this.path[2],17);
            
            this.shape.setPath(huh);
        }
    }
    
    google.maps.event.addListener(this.shape, 'mousedown', bind(this, this.mouse_down));
    google.maps.event.addListener(this.shape, 'mouseup', bind(this, this.mouse_up));
}


function fix_events(){
    var current_time = start_time;
    eventNodes.forEach( function(nodes){ 
            nodes.forEach( function(node){
                    node.set_time(current_time);
                    current_time.setMilliseconds(current_time.getMilliseconds()+(1.0/hertz*1000));
                    
                });
            
        });  
}


function create_boom_box(){
    $('#boom_pane').empty();
    if(selected_node != null){
        for(var i=0; i< boom_count;i++){
            var element = '<div class="boom_check_box"><input type="checkbox" ';
            element += ' name="boom_chk_'+i+'" id="boom_chk_'+i+'" class="boom_chk"/>'; 
            element += '<label for="boom_chk_'+i+' class="boom_label">Boom '+(i+1)+'</label><div>'         
            $('#boom_pane').append(element);
            var chk = $('#boom_chk_'+i);
            if(selected_node.booms.length > i && selected_node.booms[i].on){
                $(chk).attr('checked', true);
            }
            $(chk).change(function(){  
                    selected_node.set_boom(this.name.replace('boom_chk_',''), this.checked);
             });
        }
    }    
}

	      	
function addMajorNode(location) {
    var point = new MajorNode(location);
    point.draw();
    majorNodes.push(point);
	
    if(majorNodes.length == 2){
        drawPath(majorNodes.length-2,majorNodes.length-1); 
        draw_major_path(0,1);       
    }
    else if(majorNodes.length > 2){
        drawPath(majorNodes.length-2,majorNodes.length-1);
        draw_major_path(majorNodes.length-2,majorNodes.length-1);

    }
    fix_events();
}


function draw_major_path(start, end){
    if(start >= 0 && end < majorNodes.length){
        var new_path = new MajorPath([majorNodes[start].get_pos(),majorNodes[end].get_pos()]);
        new_path.draw();
        major_paths.splice(start,1,new_path);
    }
}


function drawPath(start,end){
    if(start >=0 && start < majorNodes.length && 
       end > 0 && end < majorNodes.length){
        var start_utm=[0,0];
        var end_utm=[0,0];
        var path_output = [];
		
        LatLonToUTMXY(DegToRad(majorNodes[start].get_pos().lat()), 
                      DegToRad(majorNodes[start].get_pos().lng()),
                      utm_zone,start_utm);
        LatLonToUTMXY(DegToRad(majorNodes[end].get_pos().lat()), 
                      DegToRad(majorNodes[end].get_pos().lng()),
                      utm_zone,end_utm);

        var total_dist = distance(start_utm,end_utm);
        var travelled = 0;
        var current_pos = start_utm;
        nodes = [];
        path_output.push(majorNodes[start].get_pos());
    
        var event = new EventNode(majorNodes[start].get_pos());
        nodes.push(event);	
        last_position = majorNodes[start].get_pos()
           
        while(true){
            var remaining = distance(current_pos,end_utm);	
            if(remaining < speed_t && remaining >0){
                current_pos = traverse_vector(current_pos, end_utm, 
                                              remaining);
                noisy_utm = add_noise_dual_variance(current_pos,
                                                    unit_vector(get_vector(current_pos,end_utm)),
                                                    f_error,r_error);
                var noisy_latlon = [0,0];
                UTMXYToLatLon(noisy_utm[0],noisy_utm[1],utm_zone,true,
                              noisy_latlon);
                path_output.push(new google.maps.LatLng(RadToDeg(noisy_latlon[0]),
                                                        RadToDeg(noisy_latlon[1])));
                break;
            }			
            current_pos = traverse_vector(current_pos, end_utm, speed_t);
            noisy_utm = add_noise_dual_variance(current_pos, 
                                                unit_vector(get_vector(current_pos,end_utm)),
                                                f_error,r_error);
            var noisy_latlon = [0,0];
            UTMXYToLatLon(noisy_utm[0],noisy_utm[1],
                          utm_zone,true,noisy_latlon);
            var position = new google.maps.LatLng(RadToDeg(noisy_latlon[0]),
                                                  RadToDeg(noisy_latlon[1]));
            path_output.push(position);
            
            var event = new EventNode(position);
            event.set_heading_from(last_position);
            nodes.push(event);	
            last_position = position;
            
        }
        
        var track = new google.maps.Polyline({path:path_output, 
					      strokeColor: "#0000FF",
					      clickable: false,strokeOpacity: 1.0, 
					      strokeWeight: 2, zIndex : path_z });
        //track.setMap(map);
        pathObjs.splice(start,0,track); //here lol		
	eventNodes.splice(start,0,nodes);
        
        current_event = [0,0,0];
        vehicle.fix();
    }
}


function initialize(){
   
    /* set up menus, sanitize inputs */
    $('#forward_error').val(f_error);
    
    $('#forward_error').keydown( function(event){
            var keyVal = (event.charCode ? event.charCode : 
                          ((event.keyCode) ? event.keyCode : event.which));
            if(keyVal == 46  || keyVal == 8 || keyVal == 190 || (keyVal >= 48 && keyVal <= 57)){                  
                    return true;
                }
            return false;

        });
    $('#forward_error').keyup( function(event){
              f_error = $('#forward_error').val();
              return true;
        });
    $('#side_error').val(r_error);
    $('#side_error').keydown(function(event){
            var keyVal = (event.charCode ? event.charCode : 
                          ((event.keyCode) ? event.keyCode : event.which));
            if(keyVal == 46  || keyVal == 8 ||keyVal == 190 || (keyVal >= 48 && keyVal <= 57)){
                    return true;
                }
            return false;

        });
    $('#side_error').keyup(function(event){
            r_error = $('#side_error').val();
        });
    $('#speed_input').val(speed_s * 3.6);
    $('#speed_input').keydown(function(event){
            var keyVal = (event.charCode ? event.charCode : 
                          ((event.keyCode) ? event.keyCode : event.which));
       
            if(keyVal == 46  || keyVal == 8 || keyVal == 190 ||(keyVal >= 48 && keyVal <= 57)){                  
                    return true;
                }
            return false;

        });
    $('#speed_input').keyup(function(event){
            speed_s = $('#speed_input').val() / 3.6;
            speed_t = speed_s/hertz;
        });
    $('#boom_input').keydown(function(event){
  
            var keyVal = (event.charCode ? event.charCode : 
                          ((event.keyCode) ? event.keyCode : event.which));
            /*if($('#boom_input').val().length > 0){
                return false;
                }*/
            if( keyVal == 8 || (keyVal >= 48 && keyVal <= 55)){
                    return true;
                }
            return false;

        });
    $('#boom_input').val(boom_count);
    $('#boom_input').keyup(function(event){
            if($('#boom_input').val().length > 1){
                $('#boom_input').val($('#boom_input').val().charAt(1));
            }
            boom_count = $('#boom_input').val();
        });


    $('#mode_input').click(function(event){
            if(path_mode){
                path_mode = false;
                $('#mode_input').val('Boom Mode');
                $('#path_pane').hide();
                $('#boom_pane').show();
                 /* optimize with global mouse down check */
                majorNodes.forEach( function(p){ p.mouse_up();});
                $('#boom_pane').empty();
            }           
            else{
                path_mode = true;
                $('#mode_input').val('Path Mode');
                $('#boom_pane').hide();
                $('#path_pane').show();
                if(selected_node != null){
                    selected_node.deselect();
                }
            }
        });

    $('#start_input').click(function(event){
            // write_events();  
            
            if(eventNodes.length == 0 || outputting){
                $('#start_input').val('Start GPS') 
                clearInterval(go_timer);
                outputting = false;
                vehicle.fix();
                $('#drive_input').val('Drive');
                driving = false;
                return;
            }
            else{
                outputting = true;
                vehicle.fix();
                $('#start_input').val('Stop GPS')
                go_timer = setInterval(post_node, 200);
            }

            function post_node(){
                if(current_event[1] == 0){
                    majorNodes[current_event[0]].update_boom_sentence();
                }
                /* replace with proper count */
                if(current_event[2] % events_per_boom == 0){
                    $.post('tracmap.html', {'stream':boom_sentence});
                }
                if(current_event[0] >= eventNodes.length){                                     
                    idling = true;
                    $('#gogo_input').val('Stop');
                    current_event[0] = eventNodes.length - 1;
                    current_event[1] = eventNodes[current_event[0]].length - 1;

                }
                if(!driving){                    
                    $.post('tracmap.html', eventNodes[current_event[0]][current_event[1]].get_nmea(true,true)); 
                }
                else if(current_event[1] < eventNodes[current_event[0]].length){
                    vehicle.go_to(current_event[0],current_event[1]);
                    $.post('tracmap.html',  {'stream':eventNodes[current_event[0]][current_event[1]].get_nmea(false,true)});
                    current_event[1]++;
                    if(current_event[1] >= eventNodes[current_event[0]].length){
                        current_event[0]++; current_event[1]=0;
                    }               
                }
                current_event[2]++;
            }
        });

    $('#drive_input').click(function(event){
            if(eventNodes.length == 0){
                return;
            }         
            if(!driving){
                $('#drive_input').val('Stop');
                driving = true;
                if(!outputting){
                    $('#start_input').click();                    
                }                 
            }
            else{
                $('#drive_input').val('Drive');
                driving = false;
            }

        });
    
    $('#reset_input').click(function(event){ 
            vehicle.fix();
        });

    $('#save_input').click(function(event){
            if(majorNodes.length > 0){
                var k = 0;
                result = "lat " + majorNodes[0].latLng.lat()+"\r\n";
                result += "lon " + majorNodes[0].latLng.lng()+"\r\n";
                for(var i=0; i<majorNodes.length-1; i++){
                    if(majorNodes[i].has_booms){
                        result += majorNodes[i].get_gps_sim_booms();
                    }
                    for(var j=0; j<eventNodes[i].length; j++){
                        result += eventNodes[i][j].get_gps_sim();
                        result +="wait "+ (1.0/hertz) +"\r\n";
                        k++;
                        
                    }
                }
                result +"speed 0\r\n";
                if(k>0){
                    form_post('tracmap.html', {'bounce':escape(result)} );
                }
            }
            return false;
        });



    var latlng = new google.maps.LatLng(-45.86914,168.56864);
    var opt = { center:latlng,
                zoom:16,
                keyboardShortcuts: false,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                disableAutoPan:false,
                disableDoubleClickZoom:true,
                navigationControl:true,
                navigationControlOptions: 
                {style:google.maps.NavigationControlStyle.SMALL },
                mapTypeControl:true,
                mapTypeControlOptions: 
                {style:google.maps.MapTypeControlStyle.DROPDOWN_MENU}
    };

    map = new google.maps.Map(document.getElementById("map"),opt);

    vehicle = new Vehicle(latlng);
   

    google.maps.event.addListener(map, 'click', function(event){ 
            /* adding two modes, path mode and boom mode */
            if(path_mode){
                addMajorNode(event.latLng);
            }
            else{
                
            }
        });
	   	
    google.maps.event.addListener(map, 'mouseup', function(event){ 
            if(moving_component != null){
                moving_component.mouse_up();
            }
        });

    google.maps.event.addListener(map, 'mousemove', function(event){ 
            if(path_mode){
                if(moving_component != null){
                    moving_component.mouse_move(event);
                }
            }
        });	
    google.maps.event.addListener(map, 'zoom_changed', function(event){
            if(map.getZoom() < eventDrawThreshold && showingEventNodes){
                showingEventNodes = false;
                eventNodes.forEach( function(nodes){ 
                        nodes.forEach( function(node){
                                node.hide(); 
                            });
						
                    });				
            }
			
            if(map.getZoom() >= eventDrawThreshold && !showingEventNodes){
                showingEventNodes = true;
                eventNodes.forEach( function(nodes){ 
                        nodes.forEach( function(node){
                                node.show(); 
                            });
						
                    });						
            }
        });
}
