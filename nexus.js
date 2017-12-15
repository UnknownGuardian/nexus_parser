/**
 * Very basic NEXUS parser
 *
 * Supports TREES block
 *
 */
'use strict'
var n = {}
n.format = 'Nexus'
n.parse = function (s) {
  if (!isNexus(s)) {
    return
  }
  let sentences = getSentences(s)
  console.log('Sentences', sentences)
  let blocks = readBlocks(sentences)
  console.log('ReadBlocks', blocks)
  let parsed = parseBlocks(blocks)
  console.log('ParsedBlocks', parsed)
  return parsed
}
n.isNexus = isNexus

function isNexus (s) {
  return s.startsWith('#NEXUS')
}
function getSentences (s) {
  return s.replace('#NEXUS', '')  // discard the first #NEXUS marker at the file
          .replace(/\[((?:.*?|\n))*?\]/gm, '')  // strip comments
          .split(';')             // split the document into sentences
          .map((x) => x.trim())   // remove trailing and starting whitespace at the end of each element
          .filter((x) => x.length > 0) // remove empty sentences from the array
}
/* function splitSentences (arr) {
  arr.map((x) => {
    var parts = x.split(/[\r\n]+/).map(x => x.trim())
  })
} */
function isBlockStart (str) {
  return str.startsWith('Begin ')
}
function isBlockEnd (str) {
  return str.startsWith('End')
}
function getBlockKeyword (str) {
  return str.split(' ')[1]
}

function readBlocks (arr) {
  // var tree = {}
  var blocks = []
  for (var i = 0; i < arr.length; i++) {
    let e = arr[i]
    // begin [keyword];
    if (isBlockStart(e)) {
      let block = {
        lines: [],
        commands: [],
        keyword: getBlockKeyword(e)
      }
      blocks.push(block)
      i++
      e = arr[i]
      while (!isBlockEnd(e) && i < arr.length) {
        block.lines.push(e)
        i++
        e = arr[i]
      }
    }
  }
  return blocks
}
function parseBlocks (arr) {
  for (var i = 0; i < arr.length; i++) {
    let block = arr[i]
    let lines = block.lines
    block.commands = {}
    for (let k = 0; k < lines.length; k++) {
      let line = lines[k]
      if (isCommand(line)) {
        let command = parseCommand(line)
        block.commands[command.name] = command
      }
    }
    if (block.commands.translate && block.commands.tree) {
      return updateNewickWithTranslation(block.commands.translate.data, block.commands.tree.data)
    }
  }
  return {}
}
function updateNewickWithTranslation (translate, tree) {
  tree = tree.replace(/\d+:/g, (match, p1, offset, string) => {
    let key = match.slice(0, -1)
    let fullName = translate[key]
    return fullName + ':'
  })
  return parseNewick(tree)
}
function isCommand (str) {
  let word = str.split('\n')[0].split(' ')[0]
  return ['tree', 'Translate'].indexOf(word) !== -1
}
function parseCommand (line) {
  let name = line.split('\n')[0].split(' ')[0]
  switch (name) {
    case 'Translate':
      let mapping = line.split('\n')
      let parsedMappings = {}
      for (let i = 1; i < mapping.length; i++) {
        let x = mapping[i].trim()
        // trim the ending comma
        if (x.endsWith(',')) {
          x = x.slice(0, -1)
        }
        let parts = x.split(' ')
        let index = parseInt(parts[0])
        let fullName = parts.slice(1).join('_')
        parsedMappings[index] = fullName
      }
      return {
        name: 'translate',
        data: parsedMappings
      }
    case 'tree':
      let parts = line.split('=')
      let newick = parts[1] + ';' // re-add the missing semicolon we parsed out.
      return {
        name: 'tree',
        data: newick
      }
  }
}
module.exports = n

  /**
   * Newick format parser in JavaScript.
   * Included to reduce dependencies on external files.
   * Modified by Matt Pope 2017
   *
   * Copyright (c) Jason Davies 2010.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   *
   * Example tree (from http://en.wikipedia.org/wiki/Newick_format):
   *
   * +--0.1--A
   * F-----0.2-----B            +-------0.3----C
   * +------------------0.5-----E
   *                            +---------0.4------D
   *
   * Newick format:
   * (A:0.1,B:0.2,(C:0.3,D:0.4)E:0.5)F;
   *
   * Converted to JSON:
   * {
   *   name: "F",
   *   branchset: [
   *     {name: "A", length: 0.1},
   *     {name: "B", length: 0.2},
   *     {
   *       name: "E",
   *       length: 0.5,
   *       branchset: [
   *         {name: "C", length: 0.3},
   *         {name: "D", length: 0.4}
   *       ]
   *     }
   *   ]
   * }
   *
   * Converted to JSON, but with no names or lengths:
   * {
   *   branchset: [
   *     {}, {}, {
   *       branchset: [{}, {}]
   *     }
   *   ]
   * }
   */
function parseNewick (s) {
  var ancestors = []
  var tree = {}
  var tokens = s.split(/\s*(;|\(|\)|,|:)\s*/)
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]
    switch (token) {
      case '(': // new branchset
        var subtree = {}
        tree.children = [subtree]
        ancestors.push(tree)
        tree = subtree
        break
      case ',': // another branch
        var subtree2 = {}
        ancestors[ancestors.length - 1].children.push(subtree2)
        tree = subtree2
        break
      case ')': // optional name next
        tree = ancestors.pop()
        break
      case ':': // optional length next
        break
      default:
        var x = tokens[i - 1]
        if (x === ')' || x === '(' || x === ',') {
          tree.name = token
        } else if (x === ':') {
          tree.length = parseFloat(token)
        }
    }
  }
  return tree
}
