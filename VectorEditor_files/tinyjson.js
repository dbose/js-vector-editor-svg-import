encode = function(obj){
  //simple partial JSON encoder implementation
  if(window.JSON && JSON.stringify) return JSON.stringify(obj);
  var enc = arguments.callee; //for purposes of recursion
  
  if(typeof obj == "boolean" || typeof obj == "number"){
      return obj+'' //should work...
  }else if(typeof obj == "string"){
    //a large portion of this is stolen from Douglas Crockford's json2.js
    return '"'+
          obj.replace(
            /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g
          , function (a) {
            return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
          })
          +'"'; //note that this isn't quite as purtyful as the usualness
  }else if(obj.length){ //simple hackish test for arrayish-ness
    for(var i = 0; i < obj.length; i++){
      obj[i] = enc(obj[i]); //encode every sub-thingy on top
    }
    return "["+obj.join(",")+"]";
  }else{
    var pairs = []; //pairs will be stored here
    for(var k in obj){ //loop through thingys
      pairs.push(enc(k)+":"+enc(obj[k])); //key: value
    }
    return "{"+pairs.join(",")+"}" //wrap in the braces
  }
}