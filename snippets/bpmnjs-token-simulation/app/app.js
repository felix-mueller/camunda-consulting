'use strict';

var lodash = require('lodash');
var $ = require('jquery');
var velocity = require('velocity-animate');
var BpmnViewer = require('bpmn-js');
var velocityui = require('velocity-ui-pack');

var viewer = new BpmnViewer({ container: '#canvas' });
var overlays = viewer.get('overlays');
var selection = viewer.get('selection');
var canvas = viewer.get('canvas');

var paused = false;
$('#file-input').on('change', readSingleFile);

function pauseAnimation() {
  paused = true;
};
function continueAnimation() {
  paused = false;
};
function readSingleFile(e) {
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    viewer.importXML(contents, function(err) {
      if (!err) {
        canvas.zoom('fit-viewport');
        initEventListener();
      } else {
        console.error('something went wrong while importing the diagram:', err);
      }
    });
  };
  reader.readAsText(file);
};

function init() {
  $('#btn_animation_start').off('click');
  $('#file-input').change();
};

function initEventListener() {
  var startElements = [];
  var messageFlows = [];
  var exclusiveGateways = [];

  //get startElements, messageFlows and exclusiveGateways
  var processes = viewer.definitions.rootElements.filter(function(moddleElement) {
    if (moddleElement.messageFlows) {
      messageFlows = messageFlows.concat(moddleElement.messageFlows);
    }
    if (moddleElement.flowElements) {
      moddleElement.flowElements.filter(function(flowElement) {
        if (flowElement.$type === 'bpmn:StartEvent') {
          startElements.push(flowElement);
        }
        if (flowElement.$type === 'bpmn:ExclusiveGateway') {
          exclusiveGateways.push(flowElement);
        }
      })
      return true;
    }
  });

  exclusiveGateways.forEach(function(exclusiveGateway) {
    exclusiveGateway.outgoing.forEach(function(outgoingPath) {
      selection.select(outgoingPath,true);
    });
  });

  startElements.forEach(function(item, index) {
    if (item.outgoing && item.eventDefinitions == null) {
      $('#btn_clear').click(function() {
        init();
      });
      $('#btn_animation_stop').click(function() {
        pauseAnimation();
      });
      $('#btn_animation_continue').click(function() {
        continueAnimation();
      });
      $('#btn_animation_start').click(function() {
        var processes = viewer.definitions.rootElements.filter(function(moddleElement) {
          if (moddleElement.flowElements) {
            var startElementsWithRoutes = findRoutes(moddleElement.flowElements);
            startElementsWithRoutes.forEach(function(startElement) {
              if (startElement.eventDefinitions == null) {
                var $overlay = createOverlay(startElement.id,'red','');
                animateOverlay({}, $overlay, startElement, startElement.list[0], messageFlows);
              }
            });
          }
        });
      });
    }
  });
};

function animateOverlay(reached, $overlay, startElement, secondElement, messageFlows, disappear) {
  if (paused) {
    setTimeout(function() {
      animateOverlay(reached, $overlay, startElement, secondElement, messageFlows, disappear);
    },1000);
  } else {
    animate(reached, $overlay, startElement, secondElement, messageFlows, disappear);
  }
};

function animate(reached, $overlay, startElement, secondElement, messageFlows, disappear) {
  var newItems = messageFlows.filter(function(messageFlow) {
    if (messageFlow.sourceRef.id === startElement.id) {
      return true;
    } else {
      false;
    }
  });
  if (!disappear) {
    newItems.forEach(function(newItem) {
      var $overlay = createOverlay(newItem.targetRef.id,'red','1');
      animateOverlay({},$overlay, newItem.targetRef, newItem.targetRef, messageFlows);
    });
  }

  if (!reached[secondElement.id] || (reached[secondElement.id] && secondElement.$type!=='bpmn:ParallelGateway1')) {
    reached[secondElement.id] = true;
    var sequenceFlowBetweenItems = findSequenceFlow(startElement, secondElement, viewer);

    if (sequenceFlowBetweenItems) {
      var waypoints = [];
      waypoints.push(startElement.di.bounds);
      sequenceFlowBetweenItems.di.waypoint.forEach(function(waypoint) {
        waypoints.push(waypoint);
      });
      waypoints.push(secondElement.di.bounds);
    } else {
      var waypoints = [];
      waypoints.push(startElement.di.bounds);
      waypoints.push(secondElement.di.bounds);
    }
    var mySequence = [];
    waypoints.forEach(function(waypoint,index) {
      if (index>0) {
        var diffX = waypoint.x - waypoints[index-1].x;
        var diffY = waypoint.y - waypoints[index-1].y;
        if (!waypoint.height) {
          var left=-10;
          var top=-10;
        } else {
          var left = waypoint.width / 2 - 10 ;
          var top = waypoint.height / 2 - 10;
        }
        var duration = (Math.abs(diffX) + Math.abs(diffY))*5;
        var sequence = { e: $overlay.parent(), p: { left: left, top: top, translateX: "+="+diffX, translateY: "+="+diffY}, o: {easing: "linear",  duration:duration}};


        if (index == waypoints.length-1) {
          sequence.o.complete = function() {
              if (disappear) {
                $overlay.parent().css('display','none');
                secondElement.arrived+=1;
              }
              if (!disappear && secondElement.nextItems && secondElement.nextItems.length>0) {
                  secondElement.nextItems.forEach(function(item, index) {
                    if (item.$type === 'bpmn:ParallelGateway' && item.incoming.length>1) {
                      if (!item.arrived) {
                        animateOverlay(reached, $overlay, secondElement, item, messageFlows);
                        item.arrived = 1;
                      } else {
                        animateOverlay(reached, $overlay, secondElement, item, messageFlows, true);
                      }
                    }
                    else if (secondElement.$type === 'bpmn:ParallelGateway') {
                      handleParallelGateway();
                      function handleParallelGateway () {
                        if (secondElement.incoming.length < 2 || secondElement.arrived >= secondElement.incoming.length) {
                          if (index>0) {
                            $overlay = createOverlay(secondElement.id, 'red', '').css('display','block');
                            animateOverlay(reached, $overlay, secondElement, item, messageFlows);
                          } else {
                            animateOverlay(reached, $overlay, secondElement, item, messageFlows);
                          }
                        } else if (secondElement.arrived != secondElement.incoming.length) {
                            setTimeout(function() {
                              handleParallelGateway();
                            },100);
                        }
                      };
                    } else if (secondElement.$type === 'bpmn:ExclusiveGateway' && secondElement.incoming.length === 1) {
                      if (lodash.find(selection._selectedElements, {id:item.incoming[0].id}) != null) {
                        animateOverlay(reached, $overlay, secondElement, item, messageFlows);
                      }
                    } else {
                        animateOverlay(reached, $overlay, secondElement, item, messageFlows);
                    }
                  });
                }
            }
          };
        mySequence.push(sequence);
      }
    });
    Velocity.RunSequence(mySequence);
  } else {
    $overlay.css("display","none");
  }
};

function findSequenceFlow(startElement, targetElement) {
  var sequenceFlows = [];
  startElement.outgoing.forEach(function(element) {
    if (element.sourceRef == startElement && element.targetRef == targetElement) {
      sequenceFlows.push(element);
    }
  });
  if (sequenceFlows.length>0) {
    return sequenceFlows[0];
  }
};

function findRoutes (flowElements) {
  var startElements = getStartElements(flowElements);
  startElements.forEach(function(startElement,index) {
    var elements = [];
    var list = [];
    var nextPossibleItems = findAllNext(elements, flowElements, startElement, list,0);

    startElements[index].route = elements;
    startElements[index].list = list;
  });
  return startElements;
};


function findAllNext(elements, flowElements, element, list, number) {
  var nextItems = findNextPossibleItems(flowElements, element);
  var flatElements = lodash.flattenDeep(elements);
  elements.push(nextItems);
  element.nextItems = nextItems;
  list.push(element);
  nextItems.forEach(function(nextItem,index) {
    var exists = lodash.some(flatElements,nextItem);
    if (nextItem.outgoing && nextItem.outgoing.length>0 && !exists) {
      findAllNext(elements, flowElements, nextItem, list, number+1);
    }
  });
}

function findNextPossibleItems(flowElements, element) {
  if (element.outgoing && element.outgoing.length>0) {
    var nextItems = [];
    element.outgoing.forEach(function(outgoing) {
      flowElements.filter(function(flowEle) {
        var result = _.some(flowEle.incoming, function (incoming) {
          return incoming.id === outgoing.id;
        });
        if (result) {
          nextItems.push(flowEle);
        }
      });
    });
    return nextItems;
  } else {
    return [];
  }
};

function getStartElements(flowElements) {
  var startElements = [];
  flowElements.filter(function(flowElement) {
    if (flowElement.$type === 'bpmn:StartEvent') {
      startElements.push(flowElement);
    }
  });
  return startElements;
};

function createOverlay(id,color,text) {
  var overlayHtml = $('<div style="width: 20px; height: 20px; background: '+color+'; border-radius:10px; border: 1px solid '+color+';color:'+color+'">'+text+'</div>');
  overlays.add(id, {
    position: {
      top: 5,
      left: 5
    },
    show: {
    	minZoom: 0,
    	maxZoom: 50
    },
    html: overlayHtml
  });
  return overlayHtml;
};
