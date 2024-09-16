/**
 * @fileoverview This file contains methods which will format the
 * data fetched from the News API into nice looking tables for
 * output in terminal.
 * @author alvin@omgimanerd.tech (Alvin Lin)
 */

const colors = require('colors')
const moment = require('moment-timezone')
const Table = require('cli-table3')

const errors = require('./errors')
const parser = require('./parser')

const RecoverableError = errors.RecoverableError

/**
 * The default number of characters for formatting the table width.
 * @const
 * @type {number}
 */
const DEFAULT_DISPLAY_WIDTH = 80

/**
 * This method takes a string of text and separates it into lines of text
 * all of which are shorter than a given maximum line length. This will
 * strip all whitespace from the text, including indents, to respace the
 * text.
 * @param {string} text The text to format.
 * @param {number} maxLineLength The maximum length of each line. Defaults to
 *   DEFAULT_DISPLAY_WIDTH - 4
 * @return {string}
 */
const formatTextWrap = (text, maxLineLength) => {
  /**
   * We subtract 4 when calculating the space formatting for the text to
   * account for the table border and padding. This assumes a single column
   * table where the text runs edge to edge.
   */
  if (!maxLineLength) {
    // eslint-disable-next-line no-param-reassign
    maxLineLength = DEFAULT_DISPLAY_WIDTH - 4
  }
  const words = String(text).trim().replace(/[\s]+/g, ' ').split(' ')
  let lineLength = 0
  return words.reduce((result, word) => {
    if (lineLength + word.length >= maxLineLength) {
      lineLength = word.length
      return `${result}\n${word}`
    }
    lineLength += word.length + (result ? 1 : 0)
    return result ? `${result} ${word}` : `${word}`
  }, '')
}

/**
 * Formats a moment object into a string. Helper method for formatArticles().
 * @param {Object} date The moment object to format.
 * @param {string} timezone The timezone to format the date in
 * @return {string}
 */
const formatDate = (date, timezone) => {
  let m = moment(date)
  if (timezone) {
    m = m.tz(timezone)
  }
  if (m.isValid()) {
    const day = m.format('MMM Do, YYYY')
    const time = m.format('h:mma z')
    return `Published on ${day} at ${time}`.trim()
  }
  return 'Publication date not available'
}

/**
 * Internal helper function to format content into a table for display.
 * @param {string} head The header string, if one is needed
 * @param {boolean} nocolor Whether or not disable colors
 * @param {Function} fn A callback to invoke on the table to add content
 * @return {string}
 */
const formatTable = (head, nocolor, fn) => {
  if (nocolor) {
    colors.disable()
  }
  const table = new Table({
    head: head ? [head] : null,
    // Subtract 2 to account for table border
    colWidths: [DEFAULT_DISPLAY_WIDTH - 2]
  })
  fn(table)
  table.push([{
    content: 'Powered by the News API (https://newsapi.org).\n'.green +
      'Follow '.green + '@omgimanerd '.blue +
      'on Twitter and GitHub.\n'.green +
      'Open source contributions are welcome!\n'.green +
      'https://github.com/omgimanerd/getnews.tech'.underline.blue,
    hAlign: 'center'
  }])
  if (nocolor) {
    colors.enable()
  }
  return `${table.toString()}\n`
}

/**
 * This function takes the array of article results returned from the News API
 * and formats it into a table for display in your terminal.
 * It assumes that the data has the fields outlined in the documentation
 * on the News API developer documentation, and that the url to the article
 * has also been shortened.
 * @param {Array<Object>} articles A list of articles returned by a query to
 *   the News API.
 * @param {string} timezone The timezone of the requesting IP address
 * @param {boolean} nocolor Whether or not to disable colors
 * @param {boolean} reverse Format in reverse chronological order
 * @return {string}
 */
const formatArticles = (articles, timezone, nocolor, reverse) => {
  return formatTable('Articles'.bold, nocolor, table => {
    articles.sort((a, b) => {
      if (reverse) {
        return moment(b.publishedAt).diff(moment(a.publishedAt))
      }
      return moment(a.publishedAt).diff(moment(b.publishedAt))
    }).forEach(article => {
      const title = formatTextWrap(
        `${article.source.name} - ${article.title}`).bold.cyan
      const date = formatDate(article.publishedAt, timezone).cyan
      const description = formatTextWrap(
        article.description || 'No description available.')
      const url = String(article.url).underline.green
      table.push([`${title}\n${date}\n${description}\n${url}`])
    })
    if (articles.length === 0) {
      table.push(['No articles found on this topic.'])
    }
  })
}

/**
 * Formats a help prompt for output.
 * @return {string}
 */
const formatHelp = () => {
  const validArguments = []
  const validArgs = parser.VALID_ARGS
  const baseUrl = process.env.BASE_URL
  Object.keys(validArgs).forEach(key => {
    validArguments.push(`    ${key.yellow}: ${validArgs[key].description}`)
  })
  return formatTable('Help'.bold, false, table => {
    table.push([[
      '',
      // Query syntax
      `Usage: curl ${baseUrl}/` +
        `${'[query,]'.green}${'arg'.yellow}=value,${'arg'.yellow}=value`,
      '\n',
      // Valid countries
      formatTextWrap(
        `Valid countries: ${parser.VALID_COUNTRIES.join(', ').cyan}`),
      '\n',
      // Valid arguments
      'Valid arguments:',
      ...validArguments,
      '\n',
      // Valid categories to query
      formatTextWrap(
        `Valid categories: ${parser.VALID_CATEGORIES.join(', ')}`),
      '\n',
      // Example queries
      `Example queries:`,
      `    curl ${baseUrl}/trump`,
      `    curl ${baseUrl}/mass+shooting,n=20`,
      `    curl ${baseUrl}/category=business,nocolor`,
      `    curl ${baseUrl}/category=general,page=2,reverse`,
      '',
      `    firefox ${baseUrl}/s/t8wAWZW0`,
      ''
    ].join('\n')])
  })
}

/**
 * Formats an error for display.
 * @param {Error} error The error to display to the user
 * @return {string}
 */
const formatError = error => {
  let message = ''
  if (error instanceof RecoverableError) {
    message = error.message
  } else if (String(error.name).startsWith('NewsAPIError')) {
    message = formatTextWrap(error.message)
  } else {
    message = 'An error occurred on our end. Please try again later.'
  }
  const help = 'curl getnews.tech/:help'
  return formatTable(null, false, table => {
    table.push([{
      content: `\n${message}\n\n${help.red}\n`,
      hAlign: 'center'
    }])
  })
}

module.exports = exports = {
  formatTextWrap,
  formatDate,
  formatArticles,
  formatHelp,
  formatError
}
