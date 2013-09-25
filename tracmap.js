
/**************************************************************************/
/**                         VECTOR FUNCTIONS                             **/
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
  
function latlng_to_utm_array(array, result){
    var length = 0;
    var prev;
    for(var i=0;i<array.length;i++){
        var t = [0,0];
        LatLonToUTMXY(DegToRad(array[i].lat()), 
                      DegToRad(array[i].lng()),
                      global.utm_zone,t);        
        result.push(t);
        if(i != 0){
            length += distance(t,prev);
        }
        prev = t;
    }
    return length;
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

function add_meters_to_latLng(x_m, y_m, latLng){
    var utm = [0,0];
    LatLonToUTMXY(DegToRad(latLng.lat()), DegToRad(latLng.lng()), global.utm_zone, utm);
    utm[0] += x_m;
    utm[1] += y_m;
    var lat_lng_out = [0,0];
    UTMXYToLatLon(utm[0], utm[1], global.utm_zone, true, lat_lng_out);
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
            add_meters_to_latLng(0, -size, latLng)];
}


/**************************************************************************/
/**                           GPS FUNCTIONS                              **/
/**************************************************************************/


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
/**                       JAVASCRIPT FUNCTIONS                           **/
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
/**                              CLASSES                                 **/
/**************************************************************************/


/* Draggable base class.  Must bind callbacks to actually drag */
function Draggable(_latLng){
    this.latLng = _latLng;
    this.shape;
    this.size;
    this.moving = false;

	
    this.end_move = function(){
        if(this.moving){
            this.finalize_move();
        }
        this.moving = false;
        /* kludge ... consider another to figure this out */
        if(global.moving_component != null && global.moving_component != this){
            global.moving_component.end_move();
        }
        global.moving_component = null;
        return true;
    }

    this.start_move = function(){
        global.moving_component = this;
        this.moving = true;
    }

    this.move_click = function(){
        if(!this.moving && global.moving_component == null){
            this.start_move()
        }
        else{
            this.end_move();
        }
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
            this.shape.setMap(objects.map);
        }		
    }

    this.undraw = function(){
        if(typeof this.shape.setMap == 'function'){
            this.shape.setMap(null);
            if(global.selected_node == this){
                this.deselect();
            }       
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
    this.boom_attr = {center:this.latLng, strokeColor: '#00FF00',
                     strokeOpacity : 1.0, strokeWeight: 3, radius:this.radius,
                     fillOpacity: 0.0, 
                     zIndex: global.boom_z };
    this.circle = new google.maps.Circle(this.boom_attr);

    this.load = function(json){
        this.latLng = json['latLng'];
        this.position =json['position'];
        this.radius = json['radius'];
        this.circle.setCenter(latLng);
        this.on = json['on']; 
        if(!this.on){
            this.turn_off();
        }
    }
    if(!this.on){
        this.on = false;
        this.circle.setOptions({strokeColor:this.off_colour});
    }
    this.draw = function(){
        this.circle.setMap(objects.map);
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
    this.attr = {center:this.latLng, strokeColor: this.colour,
                strokeOpacity : 0.8, strokeWeight: 1, radius:this.size,
                fillColor: this.colour, fillOpacity: this.opacity, 
                zIndex: global.major_z }
    this.shape = new google.maps.Circle(this.attr);

    this.load = function(json){
        this.latLng = json['latLng'];
        this.shape.setCenter(latLng);
        this.has_booms = json['has_booms'];
    }
	
    this.remove = function(){	
        if(global.path_mode){
            this.undraw();
            if(this.has_booms){
                for(var i=0;i<this.booms.length;i++){
                    this.booms[i].setMap(null);
                }
            }
            var i = objects.major_nodes.indexOf(this);
            objects.major_nodes.splice(i,1);			
            splice_out_major_path(i);
            if(i-1 >= 0){
                splice_out_major_path(i-1);
            }
            draw_major_path(i-1,i);
            splice_out_path(i);
            if(i-1 >= 0){
                splice_out_path(i-1);
            }	
            draw_events(i-1,i);
            fix_events();	
            return false;
        }
    }

    this.move = function(event){
        if(global.path_mode){      
            this.shape.setCenter(event.latLng);	
            this.latLng = event.latLng;
            var i = objects.major_nodes.indexOf(this);
            if(i-1 >= 0){
                objects.major_paths[i-1].set_path([objects.major_nodes[i-1].get_pos(),
                                                  objects.major_nodes[i].get_pos()]);
            }
            if(i+1 < objects.major_nodes.length){
                objects.major_paths[i].set_path([objects.major_nodes[i].get_pos(),
                                                objects.major_nodes[i+1].get_pos()]);
            }
            this.has_moved = true;
            if(this.has_booms){
                for(var i=0;i<global.boom_count;i++){
                    this.booms[i].move(event.latLng);
                }
            }
        }
    }

    this.finalize_move = function(){
        if(global.path_mode && this.has_moved){
            var i = objects.major_nodes.indexOf(this);
            splice_out_path(i);
            if(i-1 >= 0){
                splice_out_path(i-1);
            }	          
            draw_events(i-1,i);
            draw_events(i,i+1);
            fix_events();
            this.has_moved = false;
        }
    }
    
    this.select = function(){
        global.selected_node = this; //?
        this.shape.setOptions({fillColor:this.sel_colour, fillOpacity: this.sel_opacity});
    }

    this.deselect = function(){
        global.selected_node = null;
        this.shape.setOptions({fillColor:this.colour, fillOpacity: this.opacity});
    }
   
    this.create_booms = function(default_state){
        for(var i=0;i<global.boom_count;i++){
            var new_boom = new Boom(this.latLng, i, default_state);
            new_boom.draw();
            this.booms.push(new_boom);
        }
        this.has_booms = true;
        create_boom_box();
    }
    this.on_click = function(event){
        /* like convoluted nested logic?  You have come to the right place! */
        if(!global.path_mode){
            /* nothing selected */
            if(global.selected_node == null){
                this.select();
            }
            /* something else selected */
            else if(global.selected_node != this){
                global.selected_node.deselect();
                this.select();         
            }
            /* this is selected, do stuff */
            else{
                if(!this.has_booms){
                    /* this is a special case, where we will try to 
                       guess the appropriate booms */
                    this.create_booms(true);
                    var set_to_off = false;                   
                    var i = objects.major_nodes.indexOf(this)-1;
                    for(;i>=0 && !objects.major_nodes[i].has_booms;i--);
                    /* if this is first, do nothing */
                    if(i < 0 || !objects.major_nodes[i].has_booms){
                        return;
                    }
                    /* if it has any on, we will turn all off */
                    if(objects.major_nodes[i].any_booms_on()){
                        for(var j=0;j<this.booms.length;j++){
                            this.booms[j].set_state(false);
                        }
                    }
                    /* else, if all off, find the one before it and copy it */
                    else{
                        for(--i;i>=0 && (!objects.major_nodes[i].has_booms || 
                                         !objects.major_nodes[i].any_booms_on());i--);
                        if(i < 0 || !objects.major_nodes[i].has_booms){
                            return;
                        }                      
                         for(var j=0;j<objects.major_nodes[i].booms.length && j<this.booms.length ;j++){
                            this.booms[j].set_state(objects.major_nodes[i].booms[j].on);
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
                var ctrl = $('<input/>').attr({ type: 'button', 
                                                name:'add_booms'}).addClass("action_button");
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
        if(global.path_mode){
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
            global.boom_sentence = result+="N\r\n";
            return true;
        }
        return false;
    }

    this.get_gps_sim_booms = function(){     
        /*var result = "booms ";
        var i;
        for(i=0;i<this.booms.length;i++){
            result+=this.booms[i].get_word();
        }
        for(;i<6;i++){
            result+='N,';
        } 
        return result +"N\r\n";*/
        if(this.booms[0].on){
            return "gpio din4 T\r\n";
        }
        else{
           return "gpio din4 T\r\n";
        }
        
    }

    google.maps.event.addListener(this.shape, 'dblclick', bind(this, this.on_dbl_click));
    google.maps.event.addListener(this.shape, 'rightclick', bind(this, this.move_click));
    google.maps.event.addListener(this.shape, 'click', bind(this, this.on_click));
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
                                           strokeWeight: 7, zIndex : global.basic_z });   
    this.has_moved = false;
    this.first_move = true;
    this.guide_shape = new google.maps.Polyline({path:[],
                                                strokeColor: "#FF0000",
                                                 strokeOpacity: 1, clickable: false,
                                                strokeWeight: 2, zIndex : global.basic_z });
    this.guide_path = [];
    this.set_path = function(path){
        this.path = path;
        this.shape.setPath(path);
        this.start = path[0];
        this.end = path[path.length-1];
    } 
    this.move = function(event){
        if(global.path_mode){ 
            if(this.first_move){
                this.first_move = false;
                this.guide_path = [this.start,event.latLng,this.end];
                this.guide_shape.setMap(objects.map);
            }         
            this.guide_path[1] = event.latLng;              
            this.guide_shape.setPath(this.guide_path);
            this.has_moved = true;
            this.path = cubic_bezier(this.guide_path[0],mid_point(this.guide_path[0],this.guide_path[1]), 
                                     mid_point(this.guide_path[1],this.guide_path[2]),this.guide_path[2],
                                     global.curve_segments);         
            this.shape.setPath(this.path);
            
        }
    }
    this.finalize_move = function(){
        this.guide_shape.setMap(null);
        this.first_move = true;
        if(global.path_mode && this.has_moved){             
            var i = objects.major_paths.indexOf(this);
            splice_out_path(i);
            draw_events(i,i+1);
            fix_events();
            this.has_moved = false;
        }
    }
    
    google.maps.event.addListener(this.shape, 'rightclick', bind(this, this.move_click));
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
    this.speed = (global.speed_s * global.ms_knots);
    this.siblings = null;
    this.first_move = true;
    this.altered = false;
    var attr = {center:this.latLng, strokeColor: this.colour,
                strokeOpacity : 0.8, strokeWeight: 1, radius:this.size,
                fillColor: this.colour, fillOpacity: 0.3, 
                zIndex: global.event_z, bounds: this.path }
    /* make this global? */
    this.image = new google.maps.MarkerImage('event.png', new google.maps.Size(9,9), 
                                            new google.maps.Point(0,0),
                                            new google.maps.Point(5,5));

    this.sel_image = new google.maps.MarkerImage('selected.png', new google.maps.Size(9,9), 
                                            new google.maps.Point(0,0),
                                            new google.maps.Point(5,5));
    
    this.altered_image = new google.maps.MarkerImage('altered.png', new google.maps.Size(9,9), 
                                                    new google.maps.Point(0,0),
                                                    new google.maps.Point(5,5));
    
    this.shape = new google.maps.Marker({position: this.latLng, map: objects.map, icon: this.image});

    if(objects.map.getZoom() < global.event_draw_threshold){
        this.shape.setVisible(false);
    }

    this.move = function(event){
        if(global.path_mode){ 
            if(this.first_move){
                /* select this if moving */
                if(global.selected_node == null){
                    this.select();
                }
                /* something else selected */
                else if(global.selected_node != this){
                    global.selected_node.deselect();
                    this.select();         
                }
                this.first_move=false;
                this.index = [objects.event_nodes.indexOf(this.siblings),this.siblings.indexOf(this)];               
                this.sibling_path = objects.event_paths[this.index[0]].getPath();
            }
            this.latLng = event.latLng;
            this.shape.setPosition(this.latLng);   
            this.sibling_path.setAt(this.index[1],event.latLng);
            $("#nmea_sentence").html(this.get_nmea());
        }
    }
    this.finalize_move = function(){
        this.first_move = true;
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
        this.heading +"\r\nspeed "+(global.speed_s * 3.6) + "\r\n";
    }

    this.on_click = function(event){
        /* like convoluted nested logic?  You have come to the right place! */
        if(global.path_mode){
            /* nothing selected */
            if(global.selected_node == null){
                this.select();
            }
            /* something else selected */
            else if(global.selected_node != this){
                global.selected_node.deselect();
                this.select();         
            }
        }
    }

    this.select = function(){
        $("#nmea_sentence").html(this.get_nmea());
        global.selected_node = this;
        this.shape.setIcon(this.sel_image);
        $('#event_pane').show();
    }
    
    this.deselect = function(){
        global.selected_node= null;
        $('#event_pane').hide();
        if(this.altered){
            this.shape.setIcon(this.altered_image);
        }
        else{
            this.shape.setIcon(this.image);
        }
        if(objects.map.getZoom() < global.event_draw_threshold){
            this.hide();
        }
    }

    google.maps.event.addListener(this.shape, 'click', bind(this, this.on_click));
    google.maps.event.addListener(this.shape, 'rightclick', bind(this, this.move_click));		
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
                zIndex: global.vehicle_z };

    this.shape = new google.maps.Circle(attr);
	
    this.move = function(event){
        this.shape.setCenter(event.latLng);	
        this.latLng = event.latLng;
    };
    this.go_to_start = function(){
        this.at_node = [0,0];
        this.latLng = objects.event_nodes[0][0].latLng;
        this.shape.setCenter(this.latLng);	   
    }
    this.go_to = function(i,j){
        this.at_node = [i,j];
        this.latLng = objects.event_nodes[i][j].latLng;
        this.shape.setCenter(this.latLng);       
    }
    this.fix = function(){
        global.current_event = [0,0,0];
        if(objects.major_nodes.length < 2 || !global.outputting){
            this.undraw();
            this.at_node = [-1,-1];
        }
        else{
            this.draw();
            this.go_to_start();
        }
    }
}


/**************************************************************************/
/**                         SUPPORT FUNCTIONS                            **/
/**************************************************************************/

function fix_events(){
    var current_time = global.start_time;
    objects.event_nodes.forEach( function(nodes){ 
            nodes.forEach( function(node){
                    node.set_time(current_time);
                    current_time.setMilliseconds(current_time.getMilliseconds()+(1.0/global.hertz*1000));
                    
                });           
        });  
}


function create_boom_box(){
    $('#boom_pane').empty();
    if(global.selected_node != null){
        for(var i=0; i< global.boom_count;i++){
            var element = '<div class="boom_check_box"><input type="checkbox" ';
            element += ' name="boom_chk_'+i+'" id="boom_chk_'+i+'" class="boom_chk"/>'; 
            element += '<label for="boom_chk_'+i+' class="boom_label">Boom '+(i+1)+'</label><div>'         
            $('#boom_pane').append(element);
            var chk = $('#boom_chk_'+i);
            if(global.selected_node.booms.length > i && global.selected_node.booms[i].on){
                $(chk).attr('checked', true);
            }
            $(chk).change(function(){  
                    global.selected_node.set_boom(this.name.replace('boom_chk_',''), this.checked);
             });
        }
    }    
}

	      	
function add_major_node(location) {
    var point = new MajorNode(location);
    point.draw();
    objects.major_nodes.push(point);
	
    if(objects.major_nodes.length == 2){
        draw_major_path(0,1);       
        draw_events(objects.major_nodes.length-2,objects.major_nodes.length-1); 
    }
    else if(objects.major_nodes.length > 2){
        draw_major_path(objects.major_nodes.length-2,objects.major_nodes.length-1);
        draw_events(objects.major_nodes.length-2,objects.major_nodes.length-1);

    }
    fix_events();
}


function draw_major_path(start, end){
    if(start >= 0 && end < objects.major_nodes.length){
        var new_path = new MajorPath([objects.major_nodes[start].get_pos(),objects.major_nodes[end].get_pos()]);
        new_path.draw();
        objects.major_paths.splice(start,1,new_path);
    }
}

function draw_events(start,end){
    if(start >=0 && start < objects.major_nodes.length && 
       end > 0 && end < objects.major_nodes.length){
        var start_utm=[0,0];
        var end_utm=[0,0];
	
        LatLonToUTMXY(DegToRad(objects.major_nodes[start].get_pos().lat()), 
                      DegToRad(objects.major_nodes[start].get_pos().lng()),
                      global.utm_zone,start_utm);
        LatLonToUTMXY(DegToRad(objects.major_nodes[end].get_pos().lat()), 
                      DegToRad(objects.major_nodes[end].get_pos().lng()),
                      global.utm_zone,end_utm);

        var total_dist = distance(start_utm,end_utm);
        var travelled = 0;
        var current_pos = start_utm;
        nodes = [];
    
        var event = new EventNode(objects.major_nodes[start].get_pos());
        /* event need a heading */
        nodes.push(event);	
        prev_position = objects.major_nodes[start].get_pos();
        
        var major_utm = [];
        var major_path_i = 1;
        var total_length = latlng_to_utm_array(objects.major_paths[start].path, major_utm);       
        var this_step_remaining = global.speed_t;
        while(major_path_i < major_utm.length){
            var length_to_next = distance(current_pos, major_utm[major_path_i]);
            if(this_step_remaining > length_to_next){
                current_pos = major_utm[major_path_i];
                major_path_i++;
                this_step_remaining -= length_to_next; 
            }            
            else{
                current_pos = traverse_vector(current_pos,major_utm[major_path_i], 
                                              this_step_remaining);
                noisy_utm = add_noise_dual_variance(current_pos,
                                                    unit_vector(get_vector(current_pos,
                                                                           major_utm[major_path_i])),
                                                    global.f_error,global.r_error);
                var noisy_latlon = [0,0];
                UTMXYToLatLon(noisy_utm[0],noisy_utm[1],global.utm_zone,true,
                              noisy_latlon);
                var position = new google.maps.LatLng(RadToDeg(noisy_latlon[0]),
                                                        RadToDeg(noisy_latlon[1]))
                var event = new EventNode(position);
                event.set_heading_from(prev_position);
                event.siblings = nodes;
                nodes.push(event);	
                prev_position = position;
                this_step_remaining= global.speed_t;                
            }
        }
        		
	objects.event_nodes.splice(start,0,nodes);
        
        global.current_event = [0,0,0];
        objects.vehicle.fix();
        draw_event_path(start);
    }

}

function draw_event_path(index){
    var path = [];
    for(var i=0;i<objects.event_nodes[index].length;i++){
        path.push(objects.event_nodes[index][i].get_pos());
    }
    path.push(objects.major_nodes[index+1].get_pos());
        var track = new google.maps.Polyline({path:path, 
					      strokeColor: "#0000FF",
					      clickable: false,strokeOpacity: 1.0, 
					      strokeWeight: 2, zIndex : global.path_z });
        track.setMap(objects.map);
        objects.event_paths.splice(index,0,track); //here lol
}


function splice_out_major_path(i){
    if(objects.major_paths[i]){
        objects.major_paths[i].undraw();
        objects.major_paths.splice(i,1);
    }
}

function splice_out_path(i){
    if(objects.event_paths[i]){
        objects.event_paths[i].setMap(null);
        objects.event_paths.splice(i,1);  
        objects.event_nodes[i].forEach( function(node){ 
                node.undraw();
            });	 
        objects.event_nodes.splice(i,1); 
    }
}



function initialize(){
   
    /* set up menus, sanitize inputs */
    $('#forward_error').val(global.f_error);
    
    $('#forward_error').keydown( function(event){
            var keyVal = (event.charCode ? event.charCode : 
                          ((event.keyCode) ? event.keyCode : event.which));
            if(keyVal == 46  || keyVal == 8 || keyVal == 190 || (keyVal >= 48 && keyVal <= 57)){                  
                    return true;
                }
            return false;

        });
    $('#forward_error').keyup( function(event){
              global.f_error = $('#forward_error').val();
              return true;
        });
    $('#side_error').val(global.r_error);
    $('#side_error').keydown(function(event){
            var keyVal = (event.charCode ? event.charCode : 
                          ((event.keyCode) ? event.keyCode : event.which));
            if(keyVal == 46  || keyVal == 8 ||keyVal == 190 || (keyVal >= 48 && keyVal <= 57)){
                    return true;
                }
            return false;

        });
    $('#side_error').keyup(function(event){
            global.r_error = $('#side_error').val();
        });
    $('#speed_input').val(global.speed_s * 3.6);
    $('#speed_input').keydown(function(event){
            var keyVal = (event.charCode ? event.charCode : 
                          ((event.keyCode) ? event.keyCode : event.which));
       
            if(keyVal == 46  || keyVal == 8 || keyVal == 190 ||(keyVal >= 48 && keyVal <= 57)){                  
                    return true;
                }
            return false;

        });
    $('#speed_input').keyup(function(event){
            global.speed_s = $('#speed_input').val() / 3.6;
            global.speed_t = global.speed_s/global.hertz;
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
    $('#boom_input').val(global.boom_count);
    $('#boom_input').keyup(function(event){
            if($('#boom_input').val().length > 1){
                $('#boom_input').val($('#boom_input').val().charAt(1));
            }
            global.boom_count = $('#boom_input').val();
        });


    $('#mode_input').click(function(event){
            /* need to enforce move_finalize */
            if(global.path_mode){
  
                 
                if(global.moving_component != null){
                    global.moving_component.end_move();
                }
                $('#boom_pane').empty();
                if(global.selected_node != null){
                    global.selected_node.deselect();
                }
                global.path_mode = false;
                $('#mode_input').val('Boom Mode');
                $('.path_panes').hide();
                $('.boom_panes').show();
            }           
            else{
                global.path_mode = true;
                $('#mode_input').val('Path Mode');
                $('.boom_panes').hide();
                $('.path_panes').show();
                if(global.selected_node != null){
                    global.selected_node.deselect();
                }
            }
        });

    $('#start_input').click(function(event){
            // write_events();  
            
            if(objects.event_nodes.length == 0 || global.outputting){
                $('#start_input').val('Start GPS') 
                clearInterval(global.go_timer);
                global.outputting = false;
                objects.vehicle.fix();
                $('#drive_input').val('Drive');
                global.driving = false;
                return;
            }
            else{
                global.outputting = true;
                objects.vehicle.fix();
                $('#start_input').val('Stop GPS')
                global.go_timer = setInterval(post_node, 200);
            }

            function post_node(){
                if(global.current_event[1] == 0){
                    objects.major_nodes[global.current_event[0]].update_boom_sentence();
                }
                /* replace with proper count */
                if(global.current_event[2] % global.events_per_boom == 0){
                    $.post('tracmap.html', {'stream':global.boom_sentence});
                }
                if(global.current_event[0] >= objects.event_nodes.length){                                     
                    idling = true;
                    $('#gogo_input').val('Stop');
                    global.current_event[0] = objects.event_nodes.length - 1;
                    global.current_event[1] = objects.event_nodes[global.current_event[0]].length - 1;

                }
                if(!global.driving){                    
                    $.post('tracmap.html',{'stream':
                                objects.event_nodes[global.current_event[0]][global.current_event[1]].get_nmea(true,true)}); 
                }
                else if(global.current_event[1] < objects.event_nodes[global.current_event[0]].length){
                    objects.vehicle.go_to(global.current_event[0],global.current_event[1]);
                    $.post('tracmap.html',  
                           {'stream':objects.event_nodes[global.current_event[0]][global.current_event[1]].get_nmea(false,true)});
                    global.current_event[1]++;
                    if(global.current_event[1] >= objects.event_nodes[global.current_event[0]].length){
                        global.current_event[0]++; global.current_event[1]=0;
                    }               
                }
                global.current_event[2]++;
            }
        });

    $('#drive_input').click(function(event){
            if(objects.event_nodes.length == 0){
                return;
            }         
            if(!global.driving){
                $('#drive_input').val('Stop');
                global.driving = true;
                if(!global.outputting){
                    $('#start_input').click();                    
                }                 
            }
            else{
                $('#drive_input').val('Drive');
                global.driving = false;
            }

        });
    
    $('#reset_input').click(function(event){ 
            objects.vehicle.fix();
        });

    $('#save_input').click(function(event){
            
            /*  var data = {};
            data.global = global;
            data.objects = objects;
          
            function replacer(key, value){
                if(key=="shape" || key=="siblings" || key=="circle" || key=="map" || key=="event_paths"){
                    return undefined;
                }
                return value;
            }


            var result = JSON.stringify(data, replacer);
            
            $('#coords').text(result);
            var obj = JSON.parse(result);
            var nodey = new MajorNode();
            nodey.load(obj.objects.major_nodes[0]);
            objects.major_nodes[0] = nodey;
            return;*/

            if(objects.major_nodes.length > 0){
                var k = 0;
                result = "lat " + objects.major_nodes[0].latLng.lat()+"\r\n";
                result += "lon " + objects.major_nodes[0].latLng.lng()+"\r\n";
                for(var i=0; i<objects.major_nodes.length-1; i++){
                    if(objects.major_nodes[i].has_booms){
                        result += objects.major_nodes[i].get_gps_sim_booms();
                        global.gpio_sentence=objects.major_nodes[i].get_gps_sim_booms();
                    }else{
                        result += global.gpio_sentence;
                    }
                    for(var j=0; j<objects.event_nodes[i].length; j++){
                        result += objects.event_nodes[i][j].get_gps_sim();
                        result +="wait "+ (1.0/global.hertz) +"\r\n";
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

    objects.map = new google.maps.Map(document.getElementById("map"),opt);

    objects.vehicle = new Vehicle(latlng);
   

    google.maps.event.addListener(objects.map, 'click', function(event){ 
            /* adding two modes, path mode and boom mode */
            if(global.path_mode && global.moving_component == null){
                add_major_node(event.latLng);
            }
            else{
                
            }
        });
	   	
    google.maps.event.addListener(objects.map, 'rightclick', function(event){ 
            if(global.moving_component != null){
                global.moving_component.move_click();
            }
        });

    google.maps.event.addListener(objects.map, 'mousemove', function(event){ 
            if(global.path_mode){
                if(global.moving_component != null){
                    global.moving_component.mouse_move(event);
                }
            }
        });	
    google.maps.event.addListener(objects.map, 'zoom_changed', function(event){
            if(objects.map.getZoom() < global.event_draw_threshold && global.showing_event_nodes){
                global.showing_event_nodes = false;
                objects.event_nodes.forEach( function(nodes){ 
                        nodes.forEach( function(node){
                                if(node != global.selected_node){
                                    node.hide(); 
                                }
                            });
						
                    });				
            }
			
            if(objects.map.getZoom() >= global.event_draw_threshold && !global.showing_event_nodes){
                global.showing_event_nodes = true;
                objects.event_nodes.forEach( function(nodes){ 
                        nodes.forEach( function(node){
                                node.show(); 
                            });
						
                    });						
            }
        });
}


function Global(){  

  /* gui states */
    this.showing_event_nodes = false;    
    this.event_draw_threshold = 19; //draw event_nodes with zoom level 
    this.selected_node = null;
    this.moving_component = null;

    /* output control */ 
    this.go_timer = 0;
    this.outputting  = false;
    this.driving = false;
    this.current_event = [0,0,0]; // major node, event node, tick count
    this.path_mode = true;
    this.boom_sentence = "$TMAAA,N,N,N,N,N,N,N,N\r\n";
    //this.gps_sim_boom_sentence = "booms N,N,N,N,N,N,N\n";
    this.gpio_sentence = "";
    /* z_indices */
    this.vehicle_z = 7;
    this.major_z = 2;
    this.basic_z = 1;
    this.path_z = 5;
    this.event_z = 9;
    this.boom_z = 0;
    
    /* params */
    this.utm_zone = 59;
    this.speed_s = 10.0; // m/s
    this.hertz = 5.0; // samples per second
    this.events_per_boom = 5; // event sentences per boom sentence
    this.speed_t = this.speed_s/this.hertz;
    this.f_error = 0.1;
    this.r_error = 0.05;
    this.ms_knots = 1.94384449;
    this.boom_count = 1;
    this.start_time = new Date();
    this.curve_segments = 20;
 
}

function Objects(){
    this.map;
    this.major_paths = [];
    this.event_paths = [];
    this.major_nodes = [];
    this.event_nodes = [];
    this.vehicle;

}

var global = new Global();
var objects = new Objects();

