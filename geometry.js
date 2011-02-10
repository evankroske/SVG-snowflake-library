/*
Licensed under the Apache License, Version 2.0:
http://www.apache.org/licenses/LICENSE-2.0
*/
svgNamespace = 'http://www.w3.org/2000/svg';

function indentBlock(block) {

    var output = '';
    var lines = block.split('\n');
    for (var lineIndex in lines) {
    
        var line = lines[lineIndex];
        output += '  ' + line + '\n';
    }
    return output;
}

function dump(node) {
    
    var output = '';
    for (var attributeIndex in node) {

        if (attributeIndex !== 'children') {
        
            var attribute = node[attributeIndex];
            if (typeof attribute !== 'function') {
                
                output += attributeIndex + ': ' + attribute + '\n';
            }
        }
    }
    if (node.children.length > 0) {
    
        output += 'children:\n';
    }
    
    for (var childIndex in node.children) {
    
        var child = node.children[childIndex];
        output += indentBlock(child.dump());
    }
    return output;
}

function createPoint(x, y) {

    var point = {};
    point.x = x;
    point.y = y;
    
    point.toString = function () {
        return '(' + Math.round(point.x) + ', ' + Math.round(point.y) + ')';
    }
    
    point.toPathData = function () {
        return [point.x, point.y].join(' ');
    }
    
    point.toSVG = function (svgDocument) {
    
        var pointSVG = svgDocument.createElementNS(svgNamespace, 'circle');
        pointSVG.setAttributeNS(null, 'cx', point.x);
        pointSVG.setAttributeNS(null, 'cy', point.y);
        pointSVG.setAttributeNS(null, 'r', 1);
        return pointSVG;
    }
    return point;
}

function createPolarPoint(origin, radius, degreesAngle) {

    var radiansAngle = degreesAngle * (Math.PI / 180);
    var xOffset = radius * Math.cos(radiansAngle);
    var yOffset = radius * Math.sin(radiansAngle);
    var point = createPoint(origin.x + xOffset, origin.y + yOffset);
    
    return point;
}

// Create a point on the angle between two branches
function createElbowPoint(origin, lineWidth, firstAngle, secondAngle) {
    
    var angleBetween = secondAngle - firstAngle;
    var middleAngle = (firstAngle + secondAngle) / 2;
    var offset = lineWidth / (2 * Math.sin(Math.abs(angleBetween) * Math.PI / 360));
    var elbowPoint = createPolarPoint(origin, offset, middleAngle);
    
    return elbowPoint;
}

function createPolygon(points) {

    var polygon = {};
    
    polygon.toString = function () {
    
        return 'Polygon of points ' + points
    }
    
    // Create an SVG of the polygon
    polygon.toSVG = function (svgDocument) {
    
        var pointsData = [];
        
        for (var pointIndex in points) {
        
            var point = points[pointIndex];
            pointsData.push(point.toPathData());
        }
        var polygonSVG = svgDocument.createElementNS(svgNamespace, 'polygon');
        polygonSVG.setAttributeNS(null, 'points', pointsData.join(' '));
        
        return polygonSVG;
    }
    
    return polygon;
}

function createDataNode(spreadAngle, branchLength, branchWidth, children) {

    var dataNode = {
        'spreadAngle' : spreadAngle,
        'branchLength' : branchLength,
        'branchWidth' : branchWidth,
        'children' : children
    };
    
    dataNode.toString = function() {
        
        return '[dataNode]';
    }
    
    dataNode.dump = function () {
    
        return dump(dataNode);
    }
    
    return dataNode;
}

// Record the coordinate and direction data for a node and calculate the data for its children
function createWeb(dataNode, origin, angleOffset) {
    
    var node = {};
    node.origin = origin;
    node.angleOffset = angleOffset;
    node.branchWidth = dataNode.branchWidth;
    node.children = [];
    
    // If this node isn't an endpoint
    if (dataNode.children.length > 0) {
        
        // If this node isn't an endcap
        if (dataNode.children.length > 1) {
            
            if (dataNode.spreadAngle === 360) {
            
                // Adjust the branch spacing to make sure they don't overlap
                var angleIncrement = dataNode.spreadAngle / dataNode.children.length;
                
            } else {
            
                // Adjust the branch spacing to put one at each edge of the spread angle
                var angleIncrement = dataNode.spreadAngle / (dataNode.children.length - 1);
                
            }
            // Set the angle of the first child node
            var childNodeAngleOffset = angleOffset - (dataNode.spreadAngle / 2);
            
        } else {
        
            // Make the angle of the child node match the angle of the parent node
            var angleIncrement = 0;
            var childNodeAngleOffset = angleOffset;
        }
        
        // Generate the origin and direction of all the child nodes
        for (var childDataNodeIndex in dataNode.children) {
        
            var childDataNode = dataNode.children[childDataNodeIndex];
            var childNodeAngle = childDataNodeIndex * angleIncrement + childNodeAngleOffset;
            var childNodeOrigin = createPolarPoint(origin, dataNode.branchLength, childNodeAngle);
            var childNode = createWeb(childDataNode, childNodeOrigin, childNodeAngle);
            
            node.children.push(childNode);
        }

    }
    
    node.toString = function () {
        
        return '[node]';
    }
    
    node.toSVG = function (svgDocument) {
        
        if (node.children.length > 0) {
        
            var originSVG = node.origin.toSVG(svgDocument);
            var group = svgDocument.createElementNS(svgNamespace, 'g');
            group.appendChild(originSVG);
            
            for (var childIndex in node.children) {
                var child = node.children[childIndex];
                group.appendChild(child.toSVG(svgDocument));
            }
            return group;
            
        } else {
        
            var point = node.origin.toSVG(svgDocument);
            return point;
        }
    }
    
    node.dump = function () {
    
        return dump(node);
    }
    
    return node;
}

// Add width to the branches of a web
function createSnowflake(node) {

    var snowflake = {};
    snowflake.components = [];
    snowflake.children = [];
    
    if (node.children.length > 0) {
    
        var previousAngle = node.angleOffset - 180;
        for (var childIndex in node.children) {
        
            var childNode = node.children[childIndex];
            
            // If this is not the first child of a node with a spreadAngle of 360
            if (previousAngle !== childNode.angleOffset) {
            
                // Place a vertex in the middle of the angle between the last branch and this one
                var elbowPoint = createElbowPoint(node.origin, node.branchWidth, previousAngle, childNode.angleOffset);
                snowflake.components.push(elbowPoint);
            }
            var childSnowflake = createSnowflake(childNode);
            snowflake.children.push(childSnowflake);
            snowflake.components.push(childSnowflake);
            previousAngle = childNode.angleOffset;
        }
        var finalAngle = node.angleOffset + 180;
        var elbowPoint = createElbowPoint(node.origin, node.branchWidth, previousAngle, finalAngle);
        snowflake.components.push(elbowPoint);

    } else {
    
        snowflake.components.push(node.origin);
    }
    
    snowflake.getVertices = function () {
    
        var vertices = [];
        for (var vertexIndex in snowflake.components) {
            
            var component = snowflake.components[vertexIndex];
            
            if (component.hasOwnProperty('getVertices')) {
            
                vertices = vertices.concat(component.getVertices());
            } else {
            
                vertices.push(component);
            }
        }
        
        return vertices;
    }
    
    snowflake.toString = function () {
    
        return '[snowflake]';
    }
    
    snowflake.toSVG = function (svgDocument) {
        
        var polygon = createPolygon(snowflake.getVertices());
        return polygon.toSVG(svgDocument);
    }
    
    snowflake.dump = function () {
    
        return dump(snowflake);
    }
    
    return snowflake;
}
