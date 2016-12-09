var svg;
var svgWidth;
var svgHeight;

var pausedAt;
var startedAt;
var isPlaying = false;

var BIN_COUNT = 150;

var audioCtx;
var audioSrc;
var analyser;
var frequencyData;

$(document).ready(function(){
	'use strict';
	init();
});

function init(){
	document.addEventListener('drop', dropEvent, false);
	document.addEventListener('dragover', dragOverEvent, false);
}

function dragOverEvent(evt){
	$('#loading').show();
	$('#loading').text("drop MP3...");
	evt.stopPropagation();
	evt.preventDefault();
	return false;
}

function dropEvent(evt){
	evt.stopPropagation();
	evt.preventDefault();

	if(audioSrc){
		audioSrc.disconnect();
		d3.select("svg").remove();
		$('#playcontrol').text("pause");
	}

	var droppedFiles = evt.dataTransfer.files;
	var reader = new FileReader();

	reader.onload = function(fileEvent){
		$('#loading').text("loading...");
		var data = fileEvent.target.result;
		initAudio(data);
	};

	reader.readAsArrayBuffer(droppedFiles[0]);
	createAudioTag(droppedFiles[0].name)
	
}

function createAudioTag(name){
	if(d3.select('p').empty()){
		var songName = document.createElement('p');

		songName.textContent = name;
		document.body.appendChild(songName);	
	}
	else
		$('p').text(name);
}

function createAudioButton(){
	if(d3.select("#playcontrol").empty()){
		var playButton = document.createElement('a');

		playButton.setAttribute('id', 'playcontrol');
		playButton.textContent = "pause";
		document.body.appendChild(playButton);

		playButton.addEventListener('click', function(e) {
			e.preventDefault();
			toggleAudio();
    	});
	}
}

function toggleAudio(){
	$('#playcontrol').text(isPlaying ? "play" : "pause");
    isPlaying ? pauseAudio() : playAudio();
}

function initAudio(data){
	audioCtx = null;
	audioCtx = new window.AudioContext();
	pausedAt = 0;

    if(audioCtx.decodeAudioData){
    	audioCtx.decodeAudioData(data, function(buffer){
    		audioBuffer = buffer;
    		
    		createAudioButton();
    		createAudio();
		}, function(e){
			console.log(e);
			$('#loading').text("cannot decode mp3");
		});
    }else{
    	audioSrc.buffer = audioCtx.createBuffer(data, false);
    	
    	createAudioButton();
    	createAudio();
    }
}

function createAudio(){
	analyser = audioCtx.createAnalyser();
	analyser.smoothingTimeConstant = 0.1;
	analyser.fftSize = 1024;
	
	playAudio();
}

function playAudio(){
	isPlaying = true;
	audioSrc = null;
	audioSrc = audioCtx.createBufferSource();
	audioSrc.buffer = audioBuffer;
	audioSrc.loop = true;
	startedAt = pausedAt ? Date.now() - pausedAt : Date.now();
	
	audioSrc.connect(analyser);
	audioSrc.connect(audioCtx.destination);

	pausedAt ? audioSrc.start(0, pausedAt / 1000) : audioSrc.start();
	startVisual();
}

function pauseAudio(){
    isPlaying = false;
    pausedAt = Date.now() - startedAt;

    audioSrc.stop();
    d3.select("svg").remove();
}

function startVisual(){
	$('#loading').hide();

	frequencyData = new Uint8Array(BIN_COUNT);
    svgHeight = $(window).height();
    svgWidth = $(window).width();
    svg = d3.select('div#container').append('svg')
        .classed("svg-container", true)
        .attr("preserveAspectRatio", "xMidYMid meet")
   		.attr("viewBox", "0 0 " + svgWidth + " " + svgHeight)
        .classed("svg-content", true);
    
    animate();
}

function animate(){
	requestAnimationFrame(animate);
	render();
}

function render(){
    // copy frequency data to frequencyData array.
    analyser.getByteFrequencyData(frequencyData);
    
    var radiusScale = d3.scalePow()
        .domain([0, d3.max(frequencyData)])
        .range([0, svgHeight/2 -10]);

    var hueScale = d3.scaleLinear()
        .domain([0, d3.max(frequencyData)])
        .range([0, 360]);

	var growAvg = avgLevel();
   // update d3 chart with new data
	var circles = svg.selectAll('circle')
       .data(frequencyData);

    circles.enter().append('circle');

    circles
    	.attr("r", function(d) { return radiusScale(d); })
    	.attr("cx", svgWidth / 2)
    	.attr("cy", svgHeight / 2)
    	.style("fill", "none")
    	.style("stroke-width", 4)
    	.style("stroke-opacity", 0.6)
    	.style("stroke", function(d) { return d3.hsl(hueScale(d), 1, 0.5); });
        
    d3.selectAll('circle')
    	.transition()
        	.duration(250)
			.ease(Math.sqrt)
			.attr("r", function(d, i) { return radiusScale(d) * growAvg;} )
			.style("stroke-opacity", 1e-6);
		
	d3.selectAll('circle')
		.transition()
			.duration(250)
			.ease(Math.sqrt)
			.attr("r", function(d) { return radiusScale(d);} )
			.style("stroke-opacity", 0.6)
			.style("stroke", function(d) { return d3.hsl(hueScale(d), 1, 0.5); });

	circles.exit().remove();
	d3.select(window).on("resize", resize);
}

function avgLevel(){
	var sum = 0;

	for(var i = 0; i < BIN_COUNT; i++) 
		sum += frequencyData[i];
	
	var aveLevel = sum / BIN_COUNT;
	var scaled_average = (aveLevel / 256) * 2; //256 is the highest a level can be

	return scaled_average;
}

function resize() {
    width = $(window).width();
    height = $(window).height();

    svg.attr("width", width).attr("height", height);
}