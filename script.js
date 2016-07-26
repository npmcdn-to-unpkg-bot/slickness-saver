var apiKey = "a1e5558153c6b14860cbfb09203d197e";
var mymap = L.map("map").setView([27.6648,-81.5158], 7);
//open a map and set the view to Florida
var myLayer;
var xCords = [];
var yCords = [];
var clickMode = false;
myLayer = L.layerGroup([]);
var layerOn = false;
var cordAr = [];
var defRad = 5000;
var defWid = 5;
var tempLine = L.polyline([], {color: 'red', weight:defWid}).addTo(mymap);
var completedLines = [];
var index=0;
var linesLayer = L.layerGroup([]);
var thisLine = L.layerGroup([]);
var legendOn = true;
//instatiate global variables
L.esri.basemapLayer("Streets").addTo(mymap);
//use the ESRI Streets basemap
function decideColor(data){
    if(data.rain==null){
        return 'white';
    }
    var value = -1;
    if(data.rain["3h"]!=null){
        value = data.rain["3h"];
    }
    else if(data.rain["1h"]!=null) {
        value = data.rain["1h"]*3.0;
    }
    //This is a part where there isn't really any "win" scenario. To make both data formats compatible we have to either multiply
    //the 1-hour values by three or divide the 3-hour values by three. I chose the former because I believe it is better to
    //tell users there is more rainfall than there really is, than to tell users there is less rainfall than there actually is.
    //In addition, users can see the un-edited data by clicking on the road segment.
    else if(data.weather[0].description.toLowerCase().indexOf("rain")==-1){
        return 'white'
    }
    else{
        return 'gray'
    }
    if(value==0){
        return 'white';
    }
    if(value<=2.5){
        return '#3299CC'
    }
    if(value<=5){
        return '#499DF5'
    }
    if(value<=10){
        return '#37FDFC'
    }
    if(value<=15){
        return 'yellow'
    }
    if(value<=20){
        return 'orange';
    }
    if(value<=35){
        return '#ff6666'
    }
    return 'ff0000';
}
//A function that color-codes based on rainfall values.
function show(theLayer){
    if(mymap.hasLayer(theLayer)){
        return;
    }
    layerOn = true;
    theLayer.addTo(mymap);
}
//A function that shows a layer.
function hide(theLayer){
    if(!mymap.hasLayer(theLayer)){
        return;
    }
    layerOn = false;
    mymap.removeLayer(theLayer);
}
//A function that hides a layer.
function toggle(theLayer){
    if(theLayer==null){
        return;
    }
    if(mymap.hasLayer(theLayer)){
        hide(theLayer);
    }
    else{
        show(theLayer);
    }
}
//A function that toggles a layer's visiblity.
function timing(time){
    var date = new Date(time*1000);
    return (date.getMonth()+1)+"-"+date.getDate()+"-"+date.getFullYear()+" "+date.getHours()+":"+date.getMinutes();
    return time;
}
//A function that converts UTC timestamps into a more readable format.
function map(data){
    var duplicate = false;
    for(var i =0; i<xCords.length; i++){
        if(Math.abs(data.coord.lat-xCords[i])<0.0000001 && Math.abs(data.coord.lon-yCords[i])<0.0000001){
            duplicate = true;
            break;
        }
    }
    if(duplicate){
        return;
    }
    xCords.push(data.coord.lat);
    yCords.push(data.coord.lon);
    var theColor = decideColor(data);
    var circle = L.circle([data.coord.lat,data.coord.lon], defRad, {
        color: theColor,
        fillColor: theColor,
        fillOpacity: 0.8
    }).addTo(mymap);
    myLayer.addLayer(circle);
    var popup = L.popup();
    var content = "<b>Name: </b>"+data.name+"<br><b> Weather Description: </b>"+data.weather[0].description+"<br><b>Rain Level: </b>";
    if(data.rain==null){
        content+=" None";
    }
    else{
        if(data.rain["1h"]!=null){
            content+= data.rain["1h"]+" mm in the last hour.";
        }
        else if(data.rain["3h"]!=null){
            content+= data.rain["3h"]+" mm in the last 3 hours."
        }
        else if (data.weather[0].description.toLowerCase().indexOf("rain")!=-1){
            content+= "Error. Raining but no precip data."
        }
        else{
            content += " None";
        }
    }
    content+="<br><b>Last Update: </b>"+timing(data.dt);
    popup.setContent(content);
    circle.bindPopup(popup);
    if(xCords.length==1){
        show(myLayer);
    }
}
//A function that maps a circle at the location a user queries a point at.
function onMapClick(e){
    if(clickMode){
        query(e.latlng);
    }
    else{
        lines(e.latlng);
    }
}
//A function that runs when a user clicks on the map and outsources the next task based on edit mode.
function lines(latlng){
    cordAr.push(L.latLng(latlng.lat,latlng.lng));
    tempLine.addLatLng(L.latLng(latlng.lat,latlng.lng));
}
//A function that builds a temporary polyline for users to see while building a route
function displayLine(){
    var segments = [];
    var copyCord = [];
    for(var i = 0; i<cordAr.length; i++){
        copyCord.push(L.latLng(cordAr[i].lat,cordAr[i].lng));
    }
    //I use copyCord because the timing of getJSON completion is unreliable and sometimes copyAr is cleared before it is used.
    var colors = [];
    var contents = [];
    index = 1;
    var lat1 = 0;
    var lng1 = 0;
    var theColorVar = 'brown';
    var content = "";
    var linePointer = 0;
    var totalDist = 0.0;
    for(var j = 0; j+1<copyCord.length; j++){
        totalDist+= dist(copyCord[j].lat,copyCord[j].lng,copyCord[j+1].lat,copyCord[j+1].lng);
    }
    var progress = 0.0;
    var segsDone = 0;
    var intervalLen = totalDist/20.0;
    var rem = intervalLen/2.0;
    var segPointer = 0;
    //Instantiates needed variables
    while(segPointer<20){
        //All routes' data are based upon the data at the midpoint of each segment of said route.
        //The route is divided into segments simply by dividing it into 20 sections of equal length.
        var nowLen = dist(copyCord[linePointer].lat,copyCord[linePointer].lng,copyCord[linePointer+1].lat,copyCord[linePointer+1].lng);
        var remLen = nowLen * (1.0-progress);
        if(remLen+0.0000001<rem){
            rem-=remLen;
            progress = 0.0;
            linePointer+=1;
        }
        else{
            var dLat = copyCord[linePointer+1].lat-copyCord[linePointer].lat;
            var dLng = copyCord[linePointer+1].lng-copyCord[linePointer].lng;
            var changeProgress = rem/nowLen;
            rem = intervalLen;
            var targetLoc = L.latLng(copyCord[linePointer].lat+dLat*(progress+changeProgress),copyCord[linePointer].lng+dLng*(progress+changeProgress));
            segPointer+=1;
            $.getJSON({
                dataType: "json",
                url: "http://api.openweathermap.org/data/2.5/weather?lat="+targetLoc.lat+"&lon="+targetLoc.lng+"&cnt=10&appid="+apiKey+"",
                success: function(data){

                    var content = "<b>Name: </b>"+data.name+"<br><b> Weather Description: </b>"+data.weather[0].description+"<br><b>Rain Level: </b>";
                    if(data.rain==null){
                        content+=" None";
                    }
                    else{
                        if(data.rain["1h"]!=null){
                            content+= data.rain["1h"]+" mm in the last hour.";
                        }
                        else if(data.rain["3h"]!=null){
                            content+= data.rain["3h"]+" mm in the last 3 hours."
                        }
                        else if (data.weather[0].description.toLowerCase().indexOf("rain")!=-1){
                            content+= "Error. Raining but no precip data."
                        }
                        else{
                            content += " None";
                        }
                    }
                    content+="<br><b>Last Update: </b>"+timing(data.dt);
                    content+="<br>"+index;
                    colors.push(decideColor(data));
                    contents.push(content);
                    //We get the data for the midpoint of each of the 20 segments.
                }
            }).then(function(){
                //Now we are going to display the data. This is in a then() because we are again dealing with the timing of getJSON
                var numSegs = 20.0;
                if(index==20){
                    //This is here so that we only run the displaying aspect once per route
                    var linePointer = 0;
                    var totalDist = 0.0;
                    for(var j = 0; j+1<copyCord.length; j++){
                        totalDist+= dist(copyCord[j].lat,copyCord[j].lng,copyCord[j+1].lat,copyCord[j+1].lng);
                    }
                    var progress = 0.0;
                    var segsDone = 0;
                    var intervalLen = totalDist/numSegs;
                    var rem = intervalLen;
                    var segPointer = 0;
                    while(linePointer+1<cordAr.length && segPointer<20){
                        var nowLen = dist(copyCord[linePointer].lat,copyCord[linePointer].lng,copyCord[linePointer+1].lat,copyCord[linePointer+1].lng);
                        var remLen = nowLen * (1.0-progress);
                        if(remLen<rem){
                            rem-=remLen;
                            var dLat = copyCord[linePointer+1].lat-copyCord[linePointer].lat;
                            var dLng = copyCord[linePointer+1].lng-copyCord[linePointer].lng;
                            segments.push(L.polyline([L.latLng(copyCord[linePointer].lat+dLat*progress,copyCord[linePointer].lng+dLng*progress),copyCord[linePointer+1]], {color: colors[segPointer], weight:defWid, fillOpacity:0.9, opacity:0.9, lineCap:"butt"}).addTo(mymap));
                            // segments.push(L.polyline([L.latLng(segPointer,segPointer),L.latLng(segPointer+1,segPointer+1)], {color: colors[segPointer], weight:defWid, fillOpacity:0.9, opacity:0.9, lineCap:"butt"}).addTo(mymap));
                            var popup = L.popup();
                            popup.setContent(contents[segPointer]);
                            segments[segments.length-1].bindPopup(popup);
                            progress = 0.0;
                            linePointer+=1;
                        }
                        else{
                            var dLat = copyCord[linePointer+1].lat-copyCord[linePointer].lat;
                            var dLng = copyCord[linePointer+1].lng-copyCord[linePointer].lng;
                            var changeProgress = rem/nowLen;
                            rem = intervalLen;
                            segments.push(L.polyline([L.latLng(copyCord[linePointer].lat+dLat*progress,copyCord[linePointer].lng+dLng*progress),L.latLng(copyCord[linePointer].lat+dLat*(progress+changeProgress),copyCord[linePointer].lng+dLng*(progress+changeProgress))], {color: colors[segPointer], weight:defWid, fillOpacity:0.9, opacity:0.9, lineCap:"butt"}).addTo(mymap));
                            //segments.push(L.polyline([L.latLng(segPointer,segPointer),L.latLng(segPointer+1,segPointer+1)], {color: colors[segPointer], weight:defWid, fillOpacity:0.9, opacity:0.9, lineCap:"butt"}).addTo(mymap));
                            var popup = L.popup();
                            popup.setContent(contents[segPointer]);
                            segments[segments.length-1].bindPopup(popup);
                            progress +=changeProgress;
                            segPointer+=1
                        }
                    }
                    clearLine();

                    var hereLayer = L.layerGroup(segments);
                    completedLines.push(hereLayer);
                    linesLayer.addLayer(completedLines[completedLines.length-1]);
                    if(completedLines.length==1){
                        show(linesLayer);
                    }
                    show(linesLayer);
                }
                index+=1;
            })
            progress +=changeProgress;
        }
    }
}
//A function that displays the route (with data embedded) when a user is finished building a route.
function dist(x1, y1, x2, y2){
    return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
}
//A function that calculates the distance between two points
function clearLine(){
    if(tempLine!=null){
        tempLine.setLatLngs([]);
    }
    cordAr = [];
}
//A function that cleans up the temporary route that is displayed as users build their route
function query(latlng){
    $.getJSON({
        dataType: "json",
        url: "http://api.openweathermap.org/data/2.5/weather?lat="+latlng.lat+"&lon="+latlng.lng+"&cnt=1&appid=a1e5558153c6b14860cbfb09203d197e",
        //url: "http://magic.csr.utexas.edu/public/views/gauges",
        success: function(data){
            map(data);
        }
    });
}
//Queries a specific latitude and longitude and then displays a circle at that location
mymap.on('click', onMapClick);
$( "#tog1" ).on( "click",function(){
    toggle(myLayer);
});
//Toggles point visibility
$( "#tog3" ).on( "click",function(){
    toggle(linesLayer);
});
//Toggles route visibility
$( "#tog6" ).on( "click",function(){
    $(this).text(function(a,text){
        if(text=="Small"){
            defRad = 5000;
            defWid = 5;
            for (var key in myLayer['_layers']) {
                myLayer['_layers'][key].setRadius(5000)
            }
            for(var key1 in linesLayer['_layers']){
                for(var key2 in linesLayer['_layers'][key1]['_layers']){
                    linesLayer['_layers'][key1]['_layers'][key2].setStyle({weight:5});
                }
            }
            tempLine.setStyle({weight:5});
            return "Medium";
        }
        if(text=="Medium"){
            defRad = 10000;
            defWid = 10;
            for (var key in myLayer['_layers']) {
                myLayer['_layers'][key].setRadius(10000)
            }
            for(var key1 in linesLayer['_layers']){
                for(var key2 in linesLayer['_layers'][key1]['_layers']){
                    linesLayer['_layers'][key1]['_layers'][key2].setStyle({weight:10});
                }
            }
            tempLine.setStyle({weight:10});
            return "Large";
        }
        if(text=="Large"){
            defRad = 1000;
            defWid = 1;
            for (var key in myLayer['_layers']) {
                myLayer['_layers'][key].setRadius(1000)
            }
            for(var key1 in linesLayer['_layers']){
                for(var key2 in linesLayer['_layers'][key1]['_layers']){
                    linesLayer['_layers'][key1]['_layers'][key2].setStyle({weight:1});
                }
            }
            tempLine.setStyle({weight:1});
            return "Small";
        }
    });
});
//Toggles points and routes through three preset sizes
$( "#cancel" ).on( "click",function(){
    clearLine();
});
//Cancels a route that is being built
$( "#tog4" ).on( "click",function(){
    if(legendOn){
        $("#legend").hide();
    }
    else{
        $("#legend").show();
    }
    legendOn = !legendOn;
});
//Toggles legend visibility
$( "#done" ).on( "click",function(){
    displayLine();
});
//Finished the route that the user is building
$( "#tog2" ).on( "click",function(){
    clickMode=!clickMode;
    $(this).text(function(a,text){
        if(text=="Points"){
            $("#cancel").show();
            $("#done").show();
            $("#label2").show();
            return "Routes";
        }
        else{
            clearLine();
            $("#cancel").hide();
            $("#done").hide();
            $("#label2").hide();
            return "Points";
        }
    });
});
//Toggles edit mode
$("#label6").hover(function(){
    $("#message").text('Welcome to Slickness Saver! This tool was built to assist users in analyzing the slickness of roads and weather conditions'+
        'along a given route. Applications range from helping roadside assistance personnel better respond in harsh weather conditions, to designing a safer'+
        'passage for common drivers. To start, "draw" your route by clicking on the points through which you wish to travel (in order). More in-depth details about'+
        'a specific location can be obtained by clicking on a point along an existing route. Additional information about operating Slickness Saver can be obtained'+
        'by hovering over the "🛈" symbols.');
}, function(){
    $("#message").text("")
});
$("#hid1").hover(function(){
    $("#message").text("Slickness Saver is a tool which allows users to receive rainfall data with an easy-to-use interface and " +
        "quick response time. Slickness Saver is targetted towards roadside assistance personnel (for intuitive positioning) and other users concerned " +
        "about harsh driving conditions in an effort to combat the primary cause of weather-related automobile accidents.")
}, function(){
    $("#message").text("")
});
//Shows the mission of Slickness Saver
$("#hid2").hover(function(){
    $("#message").text("Clicking any of the three buttons below toggles the named element's visibility.")
}, function(){
    $("#message").text("")
});
//Gives instructions on visibility section
$("#hid3").hover(function(){
    $("#message").text("Slickness Saver allows for users to query rainfall data in two ways. \"Routes\" Edit Mode requires users to draw their " +
        "route through a series of clicks. To cancel or complete a route, utilize Road Controls. When a route is completed, rainfall is displayed along "+
        "route. \"Points\" Edit Mode simply requires users to click the location about which that would like rainfall data.")
}, function(){
    $("#message").text("")
});
//Explains edit modes
$("#hid4").hover(function(){
    $("#message").text("Clicking the button below cycles \"Routes\" and \"Points\" through three preset sizes.")
}, function(){
    $("#message").text("")
});
//Explains size changes
$("#hid5").hover(function(){
    $("#message").text("Clicking \"Cancel Route\" eliminates the route you are currently creating and any progress cannot be regained. Clicking \"Complete " +
        "Route\" finishes the route and then displays rainfall data along the path.")
}, function(){
    $("#message").text("")
});
//Expains Route Controls
$( "#close" ).on( "click",function(){
    $("#message").text("")
});
//Allows user to close the welcome message