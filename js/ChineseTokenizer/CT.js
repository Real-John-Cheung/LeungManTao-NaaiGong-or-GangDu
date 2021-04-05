class ChineseTokenizer{
    //based on https://github.com/yishn/chinese-tokenizer
    constructor(dictContent){
      this.chinesePunctuation = [
      '·', '×', '—', '‘', '’', '“', '”', '…',
      '、', '。', '《', '》', '『', '』', '【', '】',
      '！', '（', '）', '，', '：', '；', '？'
      ]
      this.dictionary = new Cedict();
      this.dictionary.load(dictContent);
    }
    
    tokenize(text) {
          text = Array.from(text.replace(/\r/g, ''))
          let result = [];
          let i = 0;
          let [simplifiedPreference, traditionalPreference] = [0, 0];
          let pushToken = word => {
              let simplifiedEntries = this.dictionary.get(word, false);
              let traditionalEntries = this.dictionary.get(word, true);
  
              let entries = simplifiedEntries.length === 0 ? traditionalEntries :
                  traditionalEntries.length === 0 ? simplifiedEntries :
                      simplifiedPreference < traditionalPreference ? traditionalEntries :
                          simplifiedPreference > traditionalPreference ? simplifiedEntries :
                              traditionalEntries;
  
              if (traditionalEntries.length === 0 && simplifiedEntries.length > 0) {
                  simplifiedPreference++;
              } else if (simplifiedEntries.length === 0 && traditionalEntries.length > 0) {
                  traditionalPreference++;
              }
  
              result.push({
                  text: word,
                  traditional: entries[0] ? entries[0].traditional : word,
                  simplified: entries[0] ? entries[0].simplified : word,
                  matches: entries.map(({
                      pinyin,
                      english
                  }) => ({
                      pinyin,
                      english
                  }))
              });
  
              let wordArr = Array.from(word);
              let lastLineBreakIndex = word.lastIndexOf('\n');
  
              i += wordArr.length;
          }
  
          while (i < text.length) {
              // Try to match two or more characters
  
              if (i !== text.length - 1) {
                  let getTwo = text.slice(i, i + 2).join('');
                  let simplifiedEntries = this.dictionary.getPrefix(getTwo, false);
                  let traditionalEntries = this.dictionary.getPrefix(getTwo, true);
                  let foundWord = null;
                  let foundEntries = null;
  
                  for (let entries of [traditionalEntries, simplifiedEntries]) {
                      for (let entry of entries) {
                          let matchText = entries === traditionalEntries ? entry.traditional : entry.simplified;
                          let word = text.slice(i, i + Array.from(matchText).length).join('');
  
                          if (matchText === word && ( foundWord == null || Array.from(word).length > Array.from(foundWord).length)) {
                              foundWord = word;
                              foundEntries = entries;
                          }
                      }
                  }
  
                  if (foundWord != null) {
                      pushToken(foundWord);
  
                      if (foundEntries === simplifiedEntries) {
                          simplifiedPreference++;
                      } else if (foundEntries === traditionalEntries) {
                          traditionalPreference++;
                      }
  
                      continue;
                  }
              }
  
              // If it fails, match one character
  
              let character = text[i];
              let isChinese = character =>
                  this.chinesePunctuation.includes(character) ||
                  this.dictionary.get(character, false).length > 0 ||
                  this.dictionary.get(character, true).length > 0;
  
              if (isChinese(character) || character.match(/\s/) != null) {
                  pushToken(character);
                  continue;
              }
  
              // Handle non-Chinese characters
  
              let end = i + 1;
  
              for (; end < text.length; end++) {
                  if (text[end].match(/\s/) != null || isChinese(text[end])) break;
              }
  
              let word = text.slice(i, end).join('');
              pushToken(word);
          }
  
          return result;
      }
}
  
class Cedict {
    //https://github.com/yishn/chinese-tokenizer
    parseLine(line) {
        let match = line.match(/^(\S+)\s(\S+)\s\[([^\]]+)\]\s\/(.+)\//);
        if (match == null) return;
    
        let [, traditional, simplified, pinyin, english] = match;
    
        pinyin = pinyin.replace(/u:/g, 'ü');
    
        return {traditional, simplified, pinyin, english};
    }

    load(contents) {
        this.simplifiedTrie = new Trie();
        this.traditionalTrie = new Trie();

        let lines = contents.split('\n');

        for (let line of lines) {
            if (line.trim() === '' || line[0] === '#') continue;

            let entry = this.parseLine(line);
            if (entry == null) continue;

            this.simplifiedTrie.push(entry.simplified, entry);
            this.traditionalTrie.push(entry.traditional, entry);
        }
    }

    get(word, traditional = false) {
        return traditional ? this.traditionalTrie.get(word) : this.simplifiedTrie.get(word);
    }

    getPrefix(word, traditional = false) {
        return traditional ? this.traditionalTrie.getPrefix(word) : this.simplifiedTrie.getPrefix(word);
    }
}

class Trie{
    //https://github.com/yishn/chinese-tokenizer
    constructor() {
          this.content = {}
      }
      getKeyObject(key, create = false) {
          key = key.toString();
  
          let chars = key === '' ? [key] : Array.from(key);
          let obj = this.content;
  
          for (let char of chars) {
              if (obj[char] == null) {
                  if (create) obj[char] = {};
                  else return {};
              }
  
              obj = obj[char];
          }
  
          return obj;
      }
  
      get(key) {
          let obj = this.getKeyObject(key);
  
          return obj.values || [];
      }
  
      getPrefix(key) {
          let inner = (key, obj = null) => {
              if (obj == null) obj = this.getKeyObject(key);
              let result = obj.values ? [...obj.values] : [];
  
              for (let char in obj) {
                  if (char === 'values' || obj[char] == null) continue;
  
                  result.push(...inner(key + char, obj[char]));
              }
  
              return result;
          }
  
          return inner(key);
      }
  
      push(key, value) {
          let obj = this.getKeyObject(key, true);
  
          if (obj.values == null) obj.values = [];
          if (!obj.values.includes(value)) obj.values.push(value);
  
          return this;
      }
}

