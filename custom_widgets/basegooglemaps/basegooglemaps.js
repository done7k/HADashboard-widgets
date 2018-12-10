function basegooglemaps(widget_id, url, skin, parameters)
{
    self = this
    self.widget_id=widget_id
    self.parameters = parameters;
    self.OnStateAvailable = OnStateAvailable
    self.OnStateUpdate = OnStateUpdate
    self.element = element
 
    self.api_init = false
    self.api_loaded = false
    self.travelling = false
 
    self.BASE_URL =  self.parameters.base_url.split("//")[1]
    self.HISTORY_API_URL = "/api/history/period"
    self.END_TIME_URL = "?end_time="
    self.ENTITY_FILTER_URL = "?filter_entity_id="
    set_dimension(self)
    setup_events(self)

    var callbacks = []
    var monitored_entities = []

    for (device_tracker in parameters.entities){
        monitored_entities.push({"entity":  parameters.entities[device_tracker], "initial": self.OnStateAvailable, "update": self.OnStateUpdate})
    }

    WidgetBase.call(self, widget_id, url, skin, parameters, monitored_entities, callbacks) 

    function OnStateAvailable(self, state){    
        if ( "latitude" in state.attributes ){
            self.long = state.attributes.longitude
            self.lat = state.attributes.latitude
            window.self = self
            if (!self.api_loaded){
                loadScript('http://maps.googleapis.com/maps/api/js?v=3&key=' + self.parameters.api_key + '&callback=initialize')
               self.api_loaded = true
            }
        }
    }

    function OnStateUpdate(self, state){
        if (self.current_tracker  == state.entity_id){
            var center = new google.maps.LatLng(state.attributes.latitude, state.attributes.longitude)
            self.map.panTo(center)
            self.markers[state.entity_id].setPosition(new google.maps.LatLng(state.attributes.latitude, state.attributes.longitude) )
            distance = distance_lat_long(parseFloat(self.parameters.latitude), 
            parseFloat(self.parameters.longitude),parseFloat(state.attributes.latitude), parseFloat(state.attributes.longitude))
            value = parseFloat(distance.toFixed(0))
            console.log(value)
            suffix = "m"
            if (value > 1000000){
                suffix = "miles"
                value = parseFloat(value/10000).toFixed(1)
            }else if (value > 1000){
                suffix = "km"
                value = parseFloat(value/1000).toFixed(1)
            }
            distances = []
            var z = 0
            zones = {}
            for (zone in self.zone_coords){
        
                z_lat = parseFloat(self.zone_coords[zone][0])
                z_long = parseFloat(self.zone_coords[zone][1])
                var dist = distance_lat_long(z_lat, z_long, parseFloat(state.attributes.latitude), parseFloat(state.attributes.longitude))
            
                distances.push(dist)
                zones[String(distances[z].toFixed(10))] = self.zone_coords[zone][2]
                z = z + 1
            }
            var min = Math.min.apply(null, distances).toFixed(10)
             self.long = state.attributes.longitude
            self.lat = state.attributes.latitude
            
            element(self, "closest").innerHTML = "<p>" + zones[String(min)]['attributes']['friendly_name'] + "</p>"
            element(self, "distance").innerHTML = value +  " " + suffix
        }
    }

    async function handle_clicks(event){
        target = String((event.target || event.srcElement).id)
        if(target.indexOf("tracker.") == 7){
            for ( tracker of this.trackers){
                element(this, tracker).style.color = "rgba(0,0,0,0)"
            }
            self.current_tracker = target
            element(this, target).style.color = "rgba(200,200,200,0.8)"
            OnStateUpdate(self, self.entity_state[target])
        }  
        if (target == "time_travel"){
         
            if (self.travelling == false){
                self.travelling = true
                self.time_img.style.filter = ""
                self.travel = "off"
                await time_travel(self)
                console.log("starting time travel")
                await sleep(500)

            }else if (self.travelling == true){
                self.travelling = false
                self.travel = "on"
                self.time_img.style = " -webkit-filter: grayscale(100%);  filter: grayscale(100%);}"
                console.log("Stopping time travel")
                await sleep(500)
            }
        }
    }

    async function time_travel(self){
        get_history(self, self.current_tracker, "2018-12-07T00:30:00", "2018-12-07T20:30:00", travel)   
    }

    async function travel(self, result){
        var org_zoom = self.map.getZoom()
        self.travel = "off"
        self.speed = 400
        self.step = 500
        var last_time = new Date()

        for (var cord of result){
            if ("latitude" in cord['attributes']){
                var last_lat = cord['attributes']['latitude']
                var last_long = cord['attributes']['longitude']
                last_time = new Date(cord['last_changed'])
                break
            }
        }

        for ( var cord of result ){
            var divisor = 500
            if ("latitude" in cord['attributes']){
                var lat = cord['attributes']['latitude']
                var long = cord['attributes']['longitude']
                var distance = parseFloat(distance_lat_long(lat,long,last_lat,last_long))
                var time = new Date()
                var time = new Date(cord['last_changed'])
                var distance = distance_lat_long(lat,long,last_lat,last_long)
                if (distance > self.step )
                {
                    var speed = self.speed
                    if (distance > 2000)
                    {
                        var old_zoom = self.map.getZoom()
                        if (distance > 100000){ divisor = 100000; map.setZoom(8)}
                        var number_of_interpolations = parseInt(distance / divisor)

                        var current_interpolation = 0
                        var timeDiff = parseInt( (Math.abs(time.getTime() - last_time.getTime())) / number_of_interpolations )
                        while (current_interpolation < number_of_interpolations)
                        {      
                            var time = new Date(time.getTime() + timeDiff)
                            var cordinates = interpolate({lat:last_lat, long:last_long},{lat:lat, long:long},current_interpolation/number_of_interpolations)
                            var center = new google.maps.LatLng(cordinates.lat,cordinates.long)
                            self.map.panTo(center)
                            await sleep(speed)
                            current_interpolation = current_interpolation + 1
                            last_time = new Date(time)
                        }
                        last_lat = cordinates.lat
                        last_long = cordinates.long
                        last_time = new Date(time)
                        self.map.setZoom(old_zoom)
                    }
                    else
                    {
                        var center = new google.maps.LatLng(lat,long)
                        self.map.panTo(center)
                        await sleep(speed)
                        last_lat = lat
                        last_long = long
                        last_time = new Date(cord['last_changed'])
                    }
                } 
                last_lat = lat
                last_long = long
                last_time = new Date(cord['last_changed'])
            }
            var center = new google.maps.LatLng(lat, long)
            self.map.panTo(center)
            await sleep(speed)
            
        }
        self.travelling = false
        self.time_img.style = " -webkit-filter: grayscale(100%);  filter: grayscale(100%);}"
        map.setZoom(org_zoom)
    }

    function interpolate(a, b, frac) 
    {
        var nx = a.lat+(b.lat-a.lat)*frac
        var ny = a.long+(b.long-a.long)*frac
        return {lat:nx,  long:ny}
    }

    function setup_events(self){
        for ( event of ["touchstart", "click"] ) {
            element(self, "top").addEventListener(event, handle_clicks.bind(self), false)
        }
    }
 
    function loadScript(src){
        var script = document.createElement("script")
        script.type = "text/javascript"
        document.getElementsByTagName("head")[0].appendChild(script)
        script.src = src
    }

    function set_dimension(self){
        fh = element(self,"frame").clientHeight
        th = element(self,"top").clientHeight
        element(self, "map_canvas").style.height =  (fh - th ) + "px"
        self.top = element(self,"top")
    }

    function sleep(ms){
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    function toRadians(degrees){
        var pi = Math.PI;
        return degrees * (pi/180);
    }

    function distance_lat_long(lat1,lon1,lat2,lon2){
        var R = 6371e3
        var φ1 = toRadians(lat1)
      
        var φ2 = toRadians(lat2)

        var Δφ = toRadians(lat2-lat1)

        var Δλ = toRadians(lon2-lon1)

        var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2)
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    
        var d = R * c

        return d
    }

    function element(self,el){
        return document.getElementById(self.widget_id).getElementsByClassName(el)[0]
    }

    async function get_history(self, entity, start_time,end_time, done){
        request = self.HISTORY_API_URL  + self.ENTITY_FILTER_URL + entity
        var url = self.parameters.base_url + request
        console.log(url)
        var xhr = new XMLHttpRequest() 
        xhr.open("GET", url, false)
        xhr.setRequestHeader("Content-Type", "application/json")
        xhr.setRequestHeader("X-HA-access", self.parameters.pw)
        xhr.send()
        result = JSON.parse(xhr.response)
        done(self,result[0])
    }}

function initialize() {
    self = window.self
    Styles(self)
   

    var INFO_FRAME = `<div class="info_frame">
                        <b class="distance_title">Distance from home</b><div id="distance" class="distance">55 meter</div>
                      </div>`
    var CLOSEST_FRAME = `<div class="info_frame">
                      <b class="distance_title">Closest Zone</b><div id="closest" class="closest">Hemma</div>
                    </div>`
       
    var mapOptions = {zoom: self.parameters.zoom, disableDefaultUI: false,backgroundColor: 'hsla(0, 0, 0, 0)',center: new google.maps.LatLng(
        self.lat , self.long),
        styles: self.styles[self.parameters.template]};


    map = new google.maps.Map(document.getElementById('map_canvas'), mapOptions);
    self.map =  map
    DrawZones()

    if (self.api_init == true) {
        return 0
    }

    self.markers = {}
    marker_colors = ['gray', 'green', 'blue', 'orange', 'red']

    index = 0
    self.trackers = []


    for (tracker in self.entity_state){

        if ( "latitude" in self.entity_state[tracker].attributes)
        {
            lat = self.entity_state[tracker].attributes.latitude
            long = self.entity_state[tracker].attributes.longitude
           
            if ("entity_picture" in self.entity_state[tracker].attributes){
                var markerIcon = {
                    url: self.parameters.base_url + self.entity_state[tracker].attributes.entity_picture,
                    scaledSize: new google.maps.Size(40, 40)
                }

                self.markers[self.entity_state[tracker].entity_id]  = new google.maps.Marker({
                    position: new google.maps.LatLng(lat,long), map: map,
                    icon: markerIcon})

                AddTracker(self.parameters.base_url + self.entity_state[tracker].attributes.entity_picture)  
            }
            else{
                markerIcon = {
                    url: 'http://maps.google.com/mapfiles/ms/icons/' + marker_colors[index] + '.png',
                    scaledSize: new google.maps.Size(40, 40)
                } 
                self.markers[self.entity_state[tracker].entity_id] = new google.maps.Marker({
                    position: new google.maps.LatLng(lat,long), map: map,
                    icon: markerIcon,
                    label: {
                        text: self.entity_state[tracker].attributes.friendly_name,
                        color: "#ff9900",
                        fontSize: "14px",
                        fontWeight: "bold"
                    }})
                AddTracker('/custom_css/googlemaps/tracker.png')
            }
        
            index = index + 1
            if (index > Object.keys(marker_colors).length - 1) { index = 0 }
        }
    }
     

    info_frame = document.createElement("div") 
    self.element(self,"top").appendChild(info_frame)
    divider = document.createElement("div")
    divider.setAttribute("class", "divider")
    self.element(self,"top").appendChild(divider)
    info_frame.outerHTML = INFO_FRAME
    closest_frame = document.createElement("div") 
    self.element(self,"top").appendChild(closest_frame)
    divider = document.createElement("div")
    divider.setAttribute("class", "divider")
    self.element(self,"top").appendChild(divider)
    closest_frame.outerHTML = CLOSEST_FRAME
    self.current_tracker = self.trackers[0]
    time_frame = document.createElement("div")
    time_frame.setAttribute("itm_frame","")
    time_frame.setAttribute("class", "time_travel")
    time_frame.setAttribute("id", "time_travel")
    time_img = document.createElement("img")
    time_img.src = "/custom_css/googlemaps/travel.png"
    time_img.setAttribute("class", "image")
    time_img.style = " -webkit-filter: grayscale(100%);  filter: grayscale(100%);}"
    self.time_img = time_img
    self.element(self,"top").appendChild(time_frame)
    time_title = document.createElement("div")
    time_title.innerHTML = "Time travel"
    time_title.setAttribute("class", "title")
    time_frame.appendChild(time_title)
    time_frame.appendChild(time_img)
    divider = document.createElement("div")
    divider.setAttribute("class", "divider")
    self.element(self,"top").appendChild(divider)

    self.element(self, self.trackers[0]).style.color = "rgba(200,200,200,0.8)"
    self.OnStateUpdate(self, self.entity_state[self.trackers[0]] )
    self.api_init = true
    // Redraw the map when exiting from street view mode since the mapOptions are not handled correct.
    $('body').on("mouseup touchend",function(e){
        if (e.target.className == "gm-iv-back-icon-background gm-iv-back-icon"  ){
            initialize()
        }
        
   })
       
}
   