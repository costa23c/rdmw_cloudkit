/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2015 Digi International Inc., All Rights Reserved.
 */

'use strict';

angular.module('XBeeGatewayApp')
    //jshint -W098
    .controller('serialWidgetCtrl', function ($scope, utils, $log, dashboardApi, notificationService) {
        $scope.data_sending = false;
        $scope.last_received_timestamp = undefined;

        $scope.getStreamUpdateHandler = function (newData) {
            // For the serial widget, data *should* come in as an object of the form
            //   {"content": "...", "format": "base64"}
            var _newData = newData.value;
            if (_.isEmpty(_newData)) {
                $log.warn("Serial widget got malformed data", newData);
                return;
            }
            var _timestamp = newData.timestamp;
            newData = _newData;

            // XBee Gateway
            if (angular.isString(newData)) {
                var decoded = utils.base64_decode(newData);

                if (_.isEmpty(decoded)) {
                    // Might not be decoded.
                    newText = newData;
                } else {
                    // Successfully decoded the data.
                    newText = decoded;
                }
                $log.info("Adding text:", newText);
                
	//CLAUDINE'S CODE STARTS HERE
					//Claudine's Code for Wireless Distress Monitoring Network 
					var br = String.fromCharCode(10); //Carriage Return
					// Insert a CR before/after string to make it show on new line
					// on both ends
					var cr = String.fromCharCode(13);
					var zb_data = newText;
					
					//Search for the Distress Flag information's starting position
						var pos = zb_data.search("DF");
						var df_data = zb_data.slice(pos+2,pos+3);
						var df_str = "Status: ";
						//Determine the status of the worker using the distress flag
						df_data = parseInt(df_data, 10);
						if(df_data < 1){
							df_str = df_str + "OK";
						}else{
							df_str = df_str + "Distressed";
						}
						
						df_str = df_str + cr;
					
					//Search for the Heart Rate information's starting position
						pos = zb_data.search("HR");
						var hr_data = zb_data.slice(pos+2,pos+5);
						var hr_str = "Heart Rate: ";
						//Just formatting the heart rate value
						hr_data = parseInt(hr_data, 10);
						hr_str = hr_str + hr_data;
						hr_str = hr_str + cr;
					
					//Search for the Location information's starting point
						pos = zb_data.search("UTC");
						var pos_loc_end = zb_data.search("t=");
						//Cut the location substring
						var loc_data = zb_data.slice(pos, pos_loc_end-1);
						//LAT substring
						pos = loc_data.search("LAT");
						pos_loc_end = loc_data.search("LON");
						var temp_lat_str = loc_data.slice(pos+3, pos_loc_end-1);
						var lat_str = temp_lat_str.slice(0, 2) + "\xB0"	//50°
									+ temp_lat_str.slice(2,4) + "\'"	//25'
									+ temp_lat_str.slice(5, 7) + "." + temp_lat_str.slice(7, 9) + "\"" //03.10"
									+ temp_lat_str.slice(10, 11) + " ";	//N

						//LON substring
						var temp_lon_str = loc_data.slice(pos_loc_end+3, loc_data.length);
						var lon_str = temp_lon_str.slice(0, 3) + "\xB0" //104°
									+ temp_lon_str.slice(3, 5) + "\'"   //35'
									+ temp_lon_str.slice(6, 8) + "." + temp_lon_str.slice(8, 10) + "\"" //01.80"
									+ temp_lon_str.slice(11, 12); //W

						//Converting GPS string
						var loc_str = "Location: " + lat_str + lon_str;
						loc_str = loc_str + cr;
						
				//Output the worker information to the website				
				$scope.displaySerialText(cr, true);
				$scope.displaySerialText(df_str, true);
				$scope.displaySerialText(hr_str, true);
				$scope.displaySerialText(loc_str, true);
	//CLAUDINE'S CODE ENDS HERE
				
				//$scope.displaySerialText(newText, true);
                $scope.last_received_timestamp = _timestamp;	
                return;
            }
            // Or, XBee Wi-Fi
            else if (newData.content !== undefined){
                // Check format to see if we should b64 decode
                var newText;
                if(newData.format === "base64"){
                    newText = utils.base64_decode(newData.content);
                } else {
                    newText = newData.content;
                }
                $scope.displaySerialText(newText, true);
                $scope.last_received_timestamp = _timestamp;
            } else {
                // TODO display some error?
                $log.warn('Serial widget got malformed data', newData);
            }
        }

        $scope.setStreamUpdateHandler = function (newData) {
            // Updates to the set stream could be handled here too, as we use the same for get/set
            return;
        }

        $scope.serialEnterKeypress = function($event){
            if($scope.serialOutText){
               $scope.sendText($scope.serialOutText);
            }
            $event.preventDefault();
        }

        $scope.sendText = function(text) {
            $scope.data_sending = true;

            if ($scope.widget.add_carriage_returns) {
                // Insert a CR before/after string to make it show on new line
                // on both ends
                var cr = String.fromCharCode(13);
                text = "dm=" + cr + text + cr;
            }

            dashboardApi.send_serial($scope.widget.device, $scope.widget.radio, text).then(
                function(result){
                    // On success, show the sent text
                    $scope.displaySerialText(text, false);
                    // Clear the input box for next entry
                    $scope.serialOutText = null;
                    // Reenable input
                    $scope.data_sending = false;
                },
                function(reason){
                    notificationService.error("Error sending text. Please try again.");
                    // Reenable input
                    $scope.data_sending = false;
                });
        }

        $scope.$watch('data_sending', function (sending) {
            if (sending) {
                $scope.widgetState = 1;
            } else {
                $scope.widgetState = 0;
            }
        });
    })
    .directive('serialWidget', function (widgetRegistry, utils, dataStreams, $log) {
        // called after DOM element is compiled
        var linker = function postLink(scope, element) {
            scope.$element = element;
            var type = 'serial';
            var spec = widgetRegistry.get(type);

            // See http://lodash.com/docs#bind
            // (dataUpdate simply calls scope.updateHandler)
            var getCallback = _.bind(scope.getStreamUpdateHandler, scope);
            var setCallback = _.bind(scope.setStreamUpdateHandler, scope);
            utils.postlinkWidget(type, scope, element, spec, getCallback, setCallback);
            // Any more fancy footwork can be done here.

            // Manually listen for serialIn
            var device = scope.widget.device;
            var inputStream = "xbee.serialIn/[" + scope.widget.radio + "]!";
            $log.debug("Listening for serial stream: ", device, inputStream);
            var removeListener = dataStreams.listen(device, inputStream, scope.getStreamUpdateHandler);
            scope.$on('$destroy', function () {
                removeListener();
            });

            // Widget display area
            // Use jquery to find, Angular's jqlite doesn't support selector
            var output_pane = $(element).find(".serial-display");

            scope.displaySerialText = function(text, isInbound){
                var $newText = null;
                if(isInbound){
                    $newText = $('<span/>').addClass("serial-in");
                    // Show incomming text inline
                    // Split string to handle any Carriage Returns
                    if(text === "\r"){
                        $newText.append($('<br>'));
                    } else {
                        var snippets = text.split("\r");
                        _.each(snippets, function (snippet) {
                            // CR at start & end will make cause empty strings
                            if(snippet === ""){
                                $newText.append($('<br>'));
                            } else {
                                $newText.append($('<span/>').text(snippet));
                            }
                        });
                    }
                } else {
                    // Outgoing should be in it's own line
                    $newText = $('<p/>').text(text).addClass("serial-out");
                }
                $(output_pane).append($newText);
                $(output_pane).scrollTop($(output_pane)[0].scrollHeight);
            }
        };

        // AngularJS directive setup
        return {
            templateUrl: "widgets/serialWidget/serialWidget.tpl.html",
            restrict: 'AE',
            link: linker,
            controller: 'serialWidgetCtrl',
            scope: { widget: "=serialWidget", widgetState: "=state" }
        };
    })
    // This function, referred to in AngularJS as a "run block", is called by
    // AngularJS after the injector is created and is used to bootstrap the
    // application. The XBee ZigBee Cloud Kit makes use of the run block
    // to add widget definitions to the widget registry at start-up.
    .run(function(widgetRegistry) {
        // Adding the widget to the widget registry
        var widget_type_key = 'serial';
        var widget_description = 'Worker Information Widget';
        var widget_spec = {
            // Whether or not the widget is built-in or user-created
            // (i.e., whether the code is in /src/app or /src/common)
            builtin: true,
            // widget size: X,Y (columns, rows)
            size: [3, 2],
            // description appearing in 'Widget Type' list when adding new
            // widgets
            description: widget_description,
            directive: "serial-widget",
            // camel-case version of directive
            directive_c: "serialWidget",

            // properties pertaining to widget settings
            /*
            has_input: does the widget's data get updated from Device Cloud?
            sends_output: does the widget send data to the device?
            input_xform: can the user specify a custom transformation to apply
                            to incoming data? (optional)
            options: list of objects defining the settings associated with this
                        widget type
                - options generally follow the Revalidator API
                    (http://github.com/flatiron/revalidator)
            */
            has_input: false,
            sends_output: false,
            options: [
                {key: "add_carriage_returns", label: "Add Carriage Returns",
                 type: "boolean", required: false, 'default': true}
            ]
        };

        // DO NOT CHANGE ANY CODE BELOW HERE.
        widgetRegistry.put(widget_type_key, widget_spec);
    });
