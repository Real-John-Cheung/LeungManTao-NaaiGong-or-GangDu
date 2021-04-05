class Node {
  constructor(w) {
    this.w = w;
    this.c = 1;
    this.ch = {};
  }
}

class Display {
  constructor(firstResult) {
    this.result = firstResult || '載入中 ...';
  }

  update(newResult) {
    this.result = newResult;
  }

  change() {
    this.result = changeWords(this.result);
  }

  display() {
    return `<p>${this.result.join('')}`;
  }
}

const chineseNgramN = 3;

const generateChineseSentences = function (model, nValue, noOfSentence, startWith, sth = true, includeStartWith = true, strictStart = true) {
  // helpers-----------------------
  let getRandChild = function (parentNode) {
    let sum = 0;
    for (let [word, child] of Object.entries(parentNode.ch)) {
      sum += child.c;
    }
    let rand = Math.random() * sum;
    for (let [word, child] of Object.entries(parentNode.ch)) {
      rand -= child.c;
      if (rand < 0) {
        return child;
      }
    }
    return;
  }

  let findMatch = function (toMatch = []) {
    let returnedNode = model;
    while (toMatch.length > 0) {
      let w = toMatch.shift();
      if (!returnedNode.ch[w]) return null;
      returnedNode = returnedNode.ch[w];
    }
    return returnedNode;
  }

  let returnRandEle = function (arr) {
    let sum = arr.reduce((acc, node) => acc + node.c, 0);
    let rand = Math.random() * sum;
    return arr.find(node => (rand -= node.c) < 0);
  }
  //------------------------------
  const CHINESE_END_OF_SENTENCE = /[。？！…]/ //->TODOs: improve end of sentence condition
  let startToken;
  if (startWith && typeof startWith === 'string' && startWith.length > 0) {
    let pp = findMatch(chineseTokenizer.tokenize(startWith));
    if (pp !== null) {
      startToken = getRandChild(pp);
    } else if (pp === null && sth) {
      throw Error(`No sentence starts with "${startWith}" in the model`);
    } else if (pp === null && !strictStart) {
      let tem = chineseTokenizer.tokenize(startWith);
      while (pp === null && tem.length > 0) {
        tem.shift();
        pp = findMatch(tem);
      }
      if (!pp || pp.w === null) {
        let tochoose = Object.values(model.ch).filter(node => CHINESE_END_OF_SENTENCE.test(node.w))
        let p = returnRandEle(tochoose)
        startToken = getRandChild(p);
      }
    } else if (pp === null) {
      let tochoose = Object.values(model.ch).filter(node => CHINESE_END_OF_SENTENCE.test(node.w))
      let p = returnRandEle(tochoose)
      startToken = getRandChild(p);
    }
  } else {
    let tochoose = Object.values(model.ch).filter(node => CHINESE_END_OF_SENTENCE.test(node.w))
    let p = returnRandEle(tochoose)
    startToken = getRandChild(p);
  }
  let resultArray = startWith && includeStartWith ? chineseTokenizer.tokenize(startWith).map(o => o.text) : chineseTokenizer.tokenize(startToken.w).map(o => o.text);
  let sentenceCount = 0;
  let currentToken = startToken;
  while (sentenceCount < noOfSentence) {
    let nextToken;
    if (Object.entries(currentToken.ch).length != 0) {
      nextToken = getRandChild(currentToken);
    } else {
      let pre = nValue > 1 ? resultArray.slice(-(nValue - 1)) : [];//fix n = 1
      let tem = findMatch(pre);
      while (pre.length > 0 && tem === null) {
        pre.shift();
        tem = findMatch(pre);
      }// if can't find sequence of n-1 tokens, try sequence of n-2 tokens ...
      if (tem === null) tem = model;// if reach the very end of the input, start again
      nextToken = getRandChild(tem);
    }
    if (CHINESE_END_OF_SENTENCE.test(nextToken.w)) sentenceCount++;
    resultArray.push(nextToken.w);
    currentToken = nextToken;
  }

  return resultArray;
}

const postProcess = function (array) {
  const OPENRE = /[‘“「『]/;
  const ENDRE = /[’”」』]/;
  const ENDS = /[。？！…]/;
  const LBRE = /^ *[\(\{\[【（] *$/;
  const RBRE = /[\)\]\}】）]/;
  const KOPENRE = /[《〈]/;
  const KENDRE = /[》〉]/;
  const PUNCT = /[。，；、：？！…—]/;
  const ENGRE = /^ *[A-Za-z0-9\- ]+ *$/;
  const SINGLECAP = /^ *[A-Z] *$/;
  const ALLNORE = /^ *[0-9]+ *$/;

  let result = [];
  let lbopenedWith = undefined;
  let openedWith = undefined;
  let kopenedWith = undefined;
  const pair = {
    '“': '”',
    '「': '」',
    '『': '』',
    '‘': '’'
  };
  const bpair = {
    '(': ')',
    '[': ']',
    '{': '}',
    '【': '】',
    '（': '）'
  };
  const kpair = {
    '《': '》',
    '〈': '〉'
  };
  for (let i = 0; i < array.length; i++) {
    let currentToken = array[i];
    if (openedWith == undefined && ENDRE.test(currentToken)) {
      //no open close quo 
      continue;
    }
    if (openedWith == undefined && OPENRE.test(currentToken)) {
      //first open quo
      openedWith = OPENRE.exec(currentToken)[0].trim();
      result.push(currentToken);
      continue;
    }
    if (openedWith != undefined && OPENRE.test(currentToken)) {
      // result.push(pair[openedWith]);
      // result.push('，');
      // result.push(currentToken);
      // openedWith = OPENRE.exec(currentToken)[0].trim()currentToken.trim();
      continue
    }
    if (openedWith != undefined && ENDS.test(currentToken)) {
      //end of sentence without close
      if (lbopenedWith == undefined && kopenedWith == undefined) {
        result.push(currentToken);
        result.push(pair[openedWith]);
        openedWith = undefined;
        continue;
      } else if (kopenedWith == undefined) {
        result.push(bpair[lbopenedWith]);
        result.push(currentToken);
        result.push(pair[openedWith]);
        openedWith = undefined;
        lbopenedWith = undefined;
        continue;
      } else if (lbopenedWith == undefined) {
        result.push(kpair[kopenedWith]);
        result.push(currentToken);
        result.push(pair[openedWith]);
        openedWith = undefined;
        kopenedWith = undefined;
      } else {
        result.push(kpair[kopenedWith]);
        result.push(bpair[lbopenedWith]);
        result.push(currentToken);
        result.push(pair[openedWith]);
        openedWith = undefined;
        lbopenedWith = undefined;
        kopenedWith = undefined;
      }
      continue;
    }
    if (openedWith != undefined && ENDRE.test(currentToken)) {
      result.push(pair[openedWith]);
      openedWith = undefined;
      continue;
    }
    //above quo
    //below brackets
    if (lbopenedWith == undefined && RBRE.test(currentToken)) {
      continue;
    }
    if (lbopenedWith == undefined && LBRE.test(currentToken)) {
      lbopenedWith = LBRE.exec(currentToken)[0].trim();
      result.push(currentToken);
      continue;
    }
    if (lbopenedWith != undefined && LBRE.test(currentToken)) {
      result.push(bpair[lbopenedWith]);
      result.push('，');
      result.push(currentToken);
      lbopenedWith = LBRE.exec(currentToken)[0].trim();
      continue;
    }
    if (lbopenedWith != undefined && ENDS.test(currentToken)) {
      result.push(bpair[lbopenedWith]);
      result.push(currentToken);
      lbopenedWith = undefined;
      continue;
    }
    if (lbopenedWith != undefined && RBRE.test(currentToken)) {
      result.push(bpair[lbopenedWith]);
      lbopenedWith = undefined;
      continue;
    }
    //below 《〈〉》
    if (kopenedWith == undefined && KENDRE.test(currentToken)) {
      continue;
    }
    if (kopenedWith == undefined && KOPENRE.test(currentToken)) {
      kopenedWith = KOPENRE.exec(currentToken)[0].trim();
      result.push(currentToken);
      continue;
    }
    if (kopenedWith != undefined && KOPENRE.test(currentToken)) {
      result.push(kpair[kopenedWith]);
      result.push('，');
      result.push(currentToken);
      kopenedWith = KOPENRE.exec(currentToken)[0].trim();
      continue;
    }
    if (kopenedWith != undefined && PUNCT.test(currentToken)) {
      result.push(kpair[kopenedWith]);
      result.push(currentToken);
      kopenedWith = undefined;
      continue;
    }
    if (kopenedWith != undefined && KENDRE.test(currentToken)) {
      result.push(kpair[kopenedWith]);
      kopenedWith = undefined;
      continue;
    }
    // eng
    if (ENGRE.test(currentToken) && !ALLNORE.test(currentToken)) {
      if (SINGLECAP.test(currentToken) && ENGRE.test(array[i + 1]) && !ALLNORE.test(array[i + 1])) {
        result.push(" " + currentToken.trim() + array[i + 1].trim() + " ");
        i++;
        continue;
      } else {
        result.push(" " + currentToken.trim() + " ");
        continue;
      }
    }
    result.push(currentToken);
    if (ENDS.test(currentToken)) {
      openedWith = undefined;
      lbopenedWith = undefined;
      kopenedWith = undefined;
    }
  }
  return result;
}

const changeWords = function (currentArray) {
  if (!currentArray) return [];
  let newArray = currentArray.map(e => e.replace(/<(span class="changeViaPinyin"|span class="changeViaJyutpin"|\/span)>/g, ""));//clean css
  let usedbyPinyin;
  let fail = [];
  //pinyin
  let failtime = 0;
  let pinyinIdx = randInt(currentArray.length);
  let newWord = findSimilarByPinyin(currentArray[pinyinIdx]);
  while (((newWord == null || newWord.length < 2) && failtime < 90) || (newWord == null && failtime < 100)) {
    fail.push(pinyinIdx);
    failtime++;
    pinyinIdx = randInt(currentArray.length)
    while (fail.includes(pinyinIdx) && fail.length < Math.min(100, currentArray.length)) {
      pinyinIdx = randInt(currentArray.length);
    }
    newWord = findSimilarByPinyin(currentArray[pinyinIdx]);
  }
  if (newWord != null) {
    newArray[pinyinIdx] = "<span class=\"changeViaPinyin\">" + newWord + "</span>"; //add css animation
    usedbyPinyin = pinyinIdx
  }
  //
  //reset
  fail = [];
  if (usedbyPinyin != undefined || usedbyPinyin != null) fail.push(usedbyPinyin)
  failtime = 0;
  //jyutpin
  let jyutpinIdx = randInt(currentArray.length);
  while (fail.includes(jyutpinIdx)) {
    jyutpinIdx = randInt(currentArray.length);
  }
  newWord = findSimilarByJyutpin(currentArray[jyutpinIdx]);
  while (((newWord == null || newWord.length < 2) && failtime < 90) || (newWord == null && failtime < 100)) {
    fail.push(jyutpinIdx);
    failtime++;
    jyutpinIdx = randInt(currentArray.length);
    while (fail.includes(jyutpinIdx) && fail.length < Math.min(100, currentArray.length)) {
      jyutpinIdx = randInt(currentArray.length);
    }
    newWord = findSimilarByJyutpin(currentArray[jyutpinIdx]);
  }
  if (newWord != null) newArray[jyutpinIdx] = "<span class=\"changeViaJyutpin\">" + newWord + "</span>";//add css

  return newArray;
}

const findSimilarByPinyin = function (input) {
  const memorySize = 100;
  if (typeof input != 'string' || input.length == 0) return;
  if (!pyDict.hasOwnProperty(input)) return null;
  let pinyin = pyDict[input].p;
  if (typeof pinyin != 'string' || pinyin.length == 0) return null;
  pinyin = pinyin.replace(/[0-9]/g, "").trim();
  let result = undefined;
  //same pronouncation
  if (pyDict.hasOwnProperty(pinyin)) {
    let list = pyDict[pinyin];
    let chosen = list[randInt(list.length)];
    for (let i = 0; i < 100; i++) {
      if (pyDict[chosen].s != input && chosen != input && !recentReplacedPinyin.includes(chosen)) {
        result = chosen;
        recentReplacedPinyin.push(chosen);
        if (recentReplacedPinyin.length > memorySize) recentReplacedPinyin.shift();
        break;
      } else {
        chosen = list[randInt(list.length)];
      }
    }
  }
  if (result !== undefined) return pyDict[result].s ? pyDict[result].s : result;
  //similar pronouncation -> changing one character's initial
  let pinyinArray = pinyin.split(' ');
  if (pinyinArray.length > 4) return null; // too long
  for (let i = 0; i < pinyinArray.length; i++) {
    let characterToChange = pinyinArray[i].trim();
    let toChose = ['zh', 'ch', 'sh'].concat('bpmfdtnlgkhjqxzcs'.split());
    if (/^[zsc]h/.test(characterToChange)) {
      for (let op of toChose) {
        let old = characterToChange;
        characterToChange.replace(/^[zcs]h/, op);
        if (characterToChange != old) {
          //got new one, try find
          let newPinyin = pinyinArray.slice(0, i);
          newPinyin.push(characterToChange);
          newPinyin = newPinyin.concat(pinyinArray.slice(i + 1));
          if (pyDict.hasOwnProperty(newPinyin)) {
            let list = pyDict[newPinyin];
            let chosen = list[randInt(list.length)];
            for (let i = 0; i < 100; i++) {
              if (pyDict[chosen].s != input && chosen != input && !recentReplacedPinyin.includes(chosen)) {
                result = chosen;
                recentReplacedPinyin.push(chosen);
                if (recentReplacedPinyin.length > memorySize) recentReplacedPinyin.shift();
                break;
              } else {
                chosen = list[randInt(list.length)];
              }
            }
          }
          if (result !== undefined) return pyDict[result].s ? pyDict[result].s : result;
        }
      }
    } else {
      for (let op of toChose) {
        let old = characterToChange;
        characterToChange.replace(/^[a-z]/, op);
        if (characterToChange != old) {
          //got new one, try find
          let newPinyin = pinyinArray.slice(0, i);
          newPinyin.push(characterToChange);
          newPinyin = newPinyin.concat(pinyinArray.slice(i + 1));
          if (pyDict.hasOwnProperty(newPinyin)) {
            let list = pyDict[newPinyin];
            let chosen = list[randInt(list.length)];
            for (let i = 0; i < 100; i++) {
              if (pyDict[chosen].s != input && chosen != input && !recentReplacedPinyin.includes(chosen)) {
                result = chosen;
                recentReplacedPinyin.push(chosen);
                if (recentReplacedPinyin.length > memorySize) recentReplacedPinyin.shift();
                break;
              } else {
                chosen = list[randInt(list.length)];
              }
            }
          }
          if (result !== undefined) return pyDict[result].s ? pyDict[result].s : result;
        }
      }
    }
  }
  return null
}

const findSimilarByJyutpin = function (input) {
  const memorySize = 100;
  if (typeof input != 'string' || input.length == 0) return;
  if (!jpDict.hasOwnProperty(input)) return null;
  let jyutpin = jpDict[input].j;
  if (typeof jyutpin != 'string' || jyutpin.length == 0) return null;
  jyutpin = jyutpin.replace(/[0-9]/g, "").trim();
  let result = undefined;
  //same pronouncation
  if (jpDict.hasOwnProperty(jyutpin)) {
    let list = jpDict[jyutpin];
    let chosen = list[randInt(list.length)];
    for (let i = 0; i < 100; i++) {
      if (chosen != input && jpDict[chosen].s != input && !recentReplacedJyutpin.includes(chosen)) {
        result = chosen;
        recentReplacedJyutpin.push(chosen);
        if (recentReplacedJyutpin.length > memorySize) recentReplacedJyutpin.shift();
        break;
      } else {
        chosen = list[randInt(list.length)];
      }
    }
  }
  if (result !== undefined) return result;
  //similar pronouncation changing one character's initial
  let jyutpinArray = jyutpin.split(' ');
  if (jyutpinArray.length > 4) return null; // too long
  for (let i = 0; i < jyutpinArray.length; i++) {
    let characterToChange = jyutpinArray[i].trim();
    let toChose = ['gw', 'kw', 'ng'].concat('bpmfdtnlgkhwsjzc'.split());
    if (/^([gk]w|ng)[a-z]+/.test(characterToChange)) {
      for (let op in toChose) {
        let old = characterToChange;
        characterToChange = characterToChange.replace(/^[a-z][a-z]/, op);
        if (characterToChange != old) {
          let newJyutpin = jyutpinArray.slice(0, i);
          newJyutpin.push(characterToChange);
          newJyutpin.concat(jyutpinArray.slice(i + 1));
          if (jpDict.hasOwnProperty(newJyutpin)) {
            let list = jpDict[newJyutpin];
            let chosen = list[randInt(list.length)];
            for (let i = 0; i < 100; i++) {
              if (chosen != input && jpDict[chosen].s != input && !recentReplacedJyutpin.includes(chosen)) {
                result = chosen;
                recentReplacedJyutpin.push(chosen);
                if (recentReplacedJyutpin.length > memorySize) recentReplacedJyutpin.shift();
                break;
              } else {
                chosen = list[randInt(list.length)];
              }
            }
          }
          if (result !== undefined) return result;
        }
      }
    } else {
      for (let op in toChose) {
        let old = characterToChange;
        characterToChange = characterToChange.replace(/^[a-z]/, op);
        if (characterToChange != old) {
          let newJyutpin = jyutpinArray.slice(0, i);
          newJyutpin.push(characterToChange);
          newJyutpin.concat(jyutpinArray.slice(i + 1));
          if (jpDict.hasOwnProperty(newJyutpin)) {
            let list = jpDict[newJyutpin];
            let chosen = list[randInt(list.length)];
            for (let i = 0; i < 100; i++) {
              if (chosen != input && jpDict[chosen].s != input && !recentReplacedJyutpin.includes(chosen)) {
                result = chosen;
                recentReplacedJyutpin.push(chosen);
                if (recentReplacedJyutpin.length > memorySize) recentReplacedJyutpin.shift();
                break;
              } else {
                chosen = list[randInt(list.length)];
              }
            }
          }
          if (result !== undefined) return result;
        }
      }
    }
  }
  return null
}

const regenerate = function () {
  let last5token = leungManTao.result.slice(-5).join('')
  leungManTao.update(postProcess(generateChineseSentences(chineseNgramModel, chineseNgramN, 10, last5token, false, false, false)));
  while (recentReplacedJyutpin.length > 0) {
    recentReplacedJyutpin.shift();
  }
  while (recentReplacedPinyin.length > 0) {
    recentReplacedPinyin.shift();
  }
  $("#para").empty();
  $("#para").append(leungManTao.display());
}

const randInt = function (a, b) {
  if (a && b) return Math.floor(Math.random() * Math.abs(b - a)) + Math.min(a, b);
  return Math.floor(Math.random() * a);
}

const intervals = function () {
  setInterval(regenerate, 300000);
  setInterval(function () {
    leungManTao.change();
    $("#para").empty();
    $("#para").append(leungManTao.display());
  }, 2500);
}

let cedict;
let jpDict, pyDict;
let lmtText;

let cedictLoaded = false;
let jpDictLoaded = false;
let pyDictLoaded = false;
let lmtTextLoaded = false;

let recentReplacedPinyin = [];
let recentReplacedJyutpin = [];
let chineseNgramModel;
let leungManTao = new Display();
let chineseTokenizer;

$(document).ready(function () {
  console.log('Loading files');
  console.log('0%');

  fetch('./dict/cedict_1_0_ts_utf-8_mdbg.txt').then(res => res.text()).then(txt => {
    cedict = txt;
    cedictLoaded = true;
    init();
  });

  fetch('./LeungManTao.txt').then(res => res.text()).then(txt => {
    lmtText = txt;
    lmtTextLoaded = true;
    init();
  });

  fetch('./dict/jpDict.json').then(res => res.json()).then(js => {
    jpDict = js;
    jpDictLoaded = true;
    init();
  });

  fetch('./dict/pyDict.json').then(res => res.json()).then(js => {
    pyDict = js;
    pyDictLoaded = true;
    init();
  });

});

function init() {
  if (!(cedictLoaded && jpDictLoaded && pyDictLoaded && lmtTextLoaded)) {
    let par = (cedictLoaded ? 1 : 0) * 25 + (lmtTextLoaded ? 1 : 0) * 25 + (pyDictLoaded ? 1 : 0) * 25 + (jpDictLoaded ? 1 : 0) * 25;
    console.log(par + '%');
    $("#para").text("載入中 " + par + "%")
  } else {
    console.log('100%');
    $("#para").text("載入中 100%");
    console.log('Initializing Model');
    $("#para").text("正在初始化模型 ...");

    chineseTokenizer = new ChineseTokenizer(cedict);

    const buildChineseNgram = function (text, n) {
      let root = new Node(null);
      let token = chineseTokenizer.tokenize(text).map(o => o.text);
      if (n > token.length) {
        throw Error("not enough text!")
      }
      for (let i = 0; i < token.length; i++) {
        if (i + n > token.length) continue;
        let s = token.slice(i, i + n);
        let cur = root;
        for (let k = 0; k < s.length; k++) {
          if (!cur.ch[s[k]]) {
            cur.ch[s[k]] = new Node(s[k]);
          } else {
            cur.ch[s[k]].c += 1;
          }
          cur = cur.ch[s[k]];
        }
      }
      return root;
    }

    chineseNgramModel = buildChineseNgram(lmtText, chineseNgramN);

    leungManTao = new Display(postProcess(generateChineseSentences(chineseNgramModel, chineseNgramN, 10)));

    console.log(chineseNgramModel, leungManTao);
    console.log('Model Initialized');


    $("#para").empty();
    $("#para").append(leungManTao.display());

    intervals();
  }
}