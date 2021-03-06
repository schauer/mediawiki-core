( function ( mw, $ ) {
	'use strict';

	/**
	 * Utility library
	 * @class mw.util
	 * @singleton
	 */
	var util = {

		/**
		 * Initialisation
		 * (don't call before document ready)
		 */
		init: function () {
			var profile;

			/* Set tooltipAccessKeyPrefix */
			profile = $.client.profile();

			// Opera on any platform
			if ( profile.name === 'opera' ) {
				util.tooltipAccessKeyPrefix = 'shift-esc-';

			// Chrome on any platform
			} else if ( profile.name === 'chrome' ) {

				util.tooltipAccessKeyPrefix = (
					profile.platform === 'mac'
						// Chrome on Mac
						? 'ctrl-option-'
						// Chrome on Windows or Linux
						// (both alt- and alt-shift work, but alt with E, D, F etc does not
						// work since they are browser shortcuts)
						: 'alt-shift-'
				);

			// Non-Windows Safari with webkit_version > 526
			} else if ( profile.platform !== 'win'
				&& profile.name === 'safari'
				&& profile.layoutVersion > 526 ) {
				util.tooltipAccessKeyPrefix = 'ctrl-alt-';
			// Firefox 14+ on Mac
			} else if ( profile.platform === 'mac'
				&& profile.name === 'firefox'
				&& profile.versionNumber >= 14 ) {
				util.tooltipAccessKeyPrefix = 'ctrl-option-';
			// Safari/Konqueror on any platform, or any browser on Mac
			// (but not Safari on Windows)
			} else if ( !( profile.platform === 'win' && profile.name === 'safari' )
							&& ( profile.name === 'safari'
							|| profile.platform === 'mac'
							|| profile.name === 'konqueror' ) ) {
				util.tooltipAccessKeyPrefix = 'ctrl-';

			// Firefox/Iceweasel 2.x and later
			} else if ( ( profile.name === 'firefox' || profile.name === 'iceweasel' )
				&& profile.versionBase > '1' ) {
				util.tooltipAccessKeyPrefix = 'alt-shift-';
			}

			/* Fill $content var */
			util.$content = ( function () {
				var i, l, $content, selectors;
				selectors = [
					// The preferred standard for setting $content (class="mw-body")
					// You may also use (class="mw-body mw-body-primary") if you use
					// mw-body in multiple locations.
					// Or class="mw-body-primary" if you want $content to be deeper
					// in the dom than mw-body
					'.mw-body-primary',
					'.mw-body',

					/* Legacy fallbacks for setting the content */
					// Vector, Monobook, Chick, etc... based skins
					'#bodyContent',

					// Modern based skins
					'#mw_contentholder',

					// Standard, CologneBlue
					'#article',

					// #content is present on almost all if not all skins. Most skins (the above cases)
					// have #content too, but as an outer wrapper instead of the article text container.
					// The skins that don't have an outer wrapper do have #content for everything
					// so it's a good fallback
					'#content',

					// If nothing better is found fall back to our bodytext div that is guaranteed to be here
					'#mw-content-text',

					// Should never happen... well, it could if someone is not finished writing a skin and has
					// not inserted bodytext yet. But in any case <body> should always exist
					'body'
				];
				for ( i = 0, l = selectors.length; i < l; i++ ) {
					$content = $( selectors[i] ).first();
					if ( $content.length ) {
						return $content;
					}
				}

				// Make sure we don't unset util.$content if it was preset and we don't find anything
				return util.$content;
			} )();

			// Table of contents toggle
			mw.hook( 'wikipage.content' ).add( function () {
				var $tocTitle, $tocToggleLink, hideTocCookie;
				$tocTitle = $( '#toctitle' );
				$tocToggleLink = $( '#togglelink' );
				// Only add it if there is a TOC and there is no toggle added already
				if ( $( '#toc' ).length && $tocTitle.length && !$tocToggleLink.length ) {
					hideTocCookie = $.cookie( 'mw_hidetoc' );
					$tocToggleLink = $( '<a href="#" class="internal" id="togglelink"></a>' )
						.text( mw.msg( 'hidetoc' ) )
						.click( function ( e ) {
							e.preventDefault();
							util.toggleToc( $(this) );
						} );
					$tocTitle.append(
						$tocToggleLink
							.wrap( '<span class="toctoggle"></span>' )
							.parent()
								.prepend( '&nbsp;[' )
								.append( ']&nbsp;' )
					);

					if ( hideTocCookie === '1' ) {
						util.toggleToc( $tocToggleLink );
					}
				}
			} );
		},

		/* Main body */

		/**
		 * Encode the string like PHP's rawurlencode
		 *
		 * @param {string} str String to be encoded.
		 */
		rawurlencode: function ( str ) {
			str = String( str );
			return encodeURIComponent( str )
				.replace( /!/g, '%21' ).replace( /'/g, '%27' ).replace( /\(/g, '%28' )
				.replace( /\)/g, '%29' ).replace( /\*/g, '%2A' ).replace( /~/g, '%7E' );
		},

		/**
		 * Encode page titles for use in a URL
		 * We want / and : to be included as literal characters in our title URLs
		 * as they otherwise fatally break the title
		 *
		 * @param {string} str String to be encoded.
		 */
		wikiUrlencode: function ( str ) {
			return util.rawurlencode( str )
				.replace( /%20/g, '_' ).replace( /%3A/g, ':' ).replace( /%2F/g, '/' );
		},

		/**
		 * Get the link to a page name (relative to `wgServer`),
		 *
		 * @param {string} str Page name to get the link for.
		 * @param {Object} params A mapping of query parameter names to values,
		 *     e.g. { action: 'edit' }. Optional.
		 * @return {string} Location for a page with name of `str` or boolean false on error.
		 */
		getUrl: function ( str, params ) {
			var url = mw.config.get( 'wgArticlePath' ).replace( '$1',
				util.wikiUrlencode( typeof str === 'string' ? str : mw.config.get( 'wgPageName' ) ) );
			if ( params && !$.isEmptyObject( params ) ) {
				url += url.indexOf( '?' ) !== -1 ? '&' : '?';
				url += $.param( params );
			}
			return url;
		},

		/**
		 * Get address to a script in the wiki root.
		 * For index.php use `mw.config.get( 'wgScript' )`.
		 *
		 * @since 1.18
		 * @param str string Name of script (eg. 'api'), defaults to 'index'
		 * @return string Address to script (eg. '/w/api.php' )
		 */
		wikiScript: function ( str ) {
			str = str || 'index';
			if ( str === 'index' ) {
				return mw.config.get( 'wgScript' );
			} else if ( str === 'load' ) {
				return mw.config.get( 'wgLoadScript' );
			} else {
				return mw.config.get( 'wgScriptPath' ) + '/' + str +
					mw.config.get( 'wgScriptExtension' );
			}
		},

		/**
		 * Append a new style block to the head and return the CSSStyleSheet object.
		 * Use .ownerNode to access the `<style>` element, or use mw.loader#addStyleTag.
		 * This function returns the styleSheet object for convience (due to cross-browsers
		 * difference as to where it is located).
		 *
		 *     var sheet = mw.util.addCSS('.foobar { display: none; }');
		 *     $(foo).click(function () {
		 *         // Toggle the sheet on and off
		 *         sheet.disabled = !sheet.disabled;
		 *     });
		 *
		 * @param {string} text CSS to be appended
		 * @return {CSSStyleSheet} Use .ownerNode to get to the `<style>` element.
		 */
		addCSS: function ( text ) {
			var s = mw.loader.addStyleTag( text );
			return s.sheet || s.styleSheet || s;
		},

		/**
		 * Hide/show the table of contents element
		 *
		 * @param {jQuery} $toggleLink A jQuery object of the toggle link.
		 * @param {Function} [callback] Function to be called after the toggle is
		 *  completed (including the animation).
		 * @return {Mixed} Boolean visibility of the toc (true if it's visible)
		 * or Null if there was no table of contents.
		 */
		toggleToc: function ( $toggleLink, callback ) {
			var $tocList = $( '#toc ul:first' );

			// This function shouldn't be called if there's no TOC,
			// but just in case...
			if ( $tocList.length ) {
				if ( $tocList.is( ':hidden' ) ) {
					$tocList.slideDown( 'fast', callback );
					$toggleLink.text( mw.msg( 'hidetoc' ) );
					$( '#toc' ).removeClass( 'tochidden' );
					$.cookie( 'mw_hidetoc', null, {
						expires: 30,
						path: '/'
					} );
					return true;
				} else {
					$tocList.slideUp( 'fast', callback );
					$toggleLink.text( mw.msg( 'showtoc' ) );
					$( '#toc' ).addClass( 'tochidden' );
					$.cookie( 'mw_hidetoc', '1', {
						expires: 30,
						path: '/'
					} );
					return false;
				}
			} else {
				return null;
			}
		},

		/**
		 * Grab the URL parameter value for the given parameter.
		 * Returns null if not found.
		 *
		 * @param {string} param The parameter name.
		 * @param {string} [url=document.location.href] URL to search through, defaulting to the current document's URL.
		 * @return {Mixed} Parameter value or null.
		 */
		getParamValue: function ( param, url ) {
			if ( url === undefined ) {
				url = document.location.href;
			}
			// Get last match, stop at hash
			var	re = new RegExp( '^[^#]*[&?]' + $.escapeRE( param ) + '=([^&#]*)' ),
				m = re.exec( url );
			if ( m ) {
				// Beware that decodeURIComponent is not required to understand '+'
				// by spec, as encodeURIComponent does not produce it.
				return decodeURIComponent( m[1].replace( /\+/g, '%20' ) );
			}
			return null;
		},

		/**
		 * @property {string}
		 * Access key prefix. Will be re-defined based on browser/operating system
		 * detection in mw.util#init.
		 */
		tooltipAccessKeyPrefix: 'alt-',

		/**
		 * @property {RegExp}
		 * Regex to match accesskey tooltips.
		 *
		 * Should match:
		 *
		 * - "ctrl-option-"
		 * - "alt-shift-"
		 * - "ctrl-alt-"
		 * - "ctrl-"
		 *
		 * The accesskey is matched in group $6.
		 */
		tooltipAccessKeyRegexp: /\[(ctrl-)?(option-)?(alt-)?(shift-)?(esc-)?(.)\]$/,

		/**
		 * Add the appropriate prefix to the accesskey shown in the tooltip.
		 * If the nodeList parameter is given, only those nodes are updated;
		 * otherwise, all the nodes that will probably have accesskeys by
		 * default are updated.
		 *
		 * @param {Array|jQuery} [$nodes] A jQuery object, or array of nodes to update.
		 */
		updateTooltipAccessKeys: function ( $nodes ) {
			if ( !$nodes ) {
				// Rather than going into a loop of all anchor tags, limit to few elements that
				// contain the relevant anchor tags.
				// Input and label are rare enough that no such optimization is needed
				$nodes = $( '#column-one a, #mw-head a, #mw-panel a, #p-logo a, input, label' );
			} else if ( !( $nodes instanceof $ ) ) {
				$nodes = $( $nodes );
			}

			$nodes.attr( 'title', function ( i, val ) {
				if ( val && util.tooltipAccessKeyRegexp.test( val ) ) {
					return val.replace( util.tooltipAccessKeyRegexp,
						'[' + util.tooltipAccessKeyPrefix + '$6]' );
				}
				return val;
			} );
		},

		/*
		 * @property {jQuery}
		 * A jQuery object that refers to the content area element.
		 * Populated by #init.
		 */
		$content: null,

		/**
		 * Add a link to a portlet menu on the page, such as:
		 *
		 * p-cactions (Content actions), p-personal (Personal tools),
		 * p-navigation (Navigation), p-tb (Toolbox)
		 *
		 * The first three paramters are required, the others are optional and
		 * may be null. Though providing an id and tooltip is recommended.
		 *
		 * By default the new link will be added to the end of the list. To
		 * add the link before a given existing item, pass the DOM node
		 * (e.g. `document.getElementById( 'foobar' )`) or a jQuery-selector
		 * (e.g. `'#foobar'`) for that item.
		 *
		 *     mw.util.addPortletLink(
		 *         'p-tb', 'http://mediawiki.org/',
		 *         'MediaWiki.org', 't-mworg', 'Go to MediaWiki.org ', 'm', '#t-print'
		 *     );
		 *
		 * @param {string} portlet ID of the target portlet ( 'p-cactions' or 'p-personal' etc.)
		 * @param {string} href Link URL
		 * @param {string} text Link text
		 * @param {string} [id] ID of the new item, should be unique and preferably have
		 *  the appropriate prefix ( 'ca-', 'pt-', 'n-' or 't-' )
		 * @param {string} [tooltip] Text to show when hovering over the link, without accesskey suffix
		 * @param {string} [accesskey] Access key to activate this link (one character, try
		 *  to avoid conflicts. Use `$( '[accesskey=x]' ).get()` in the console to
		 *  see if 'x' is already used.
		 * @param {HTMLElement|jQuery|string} [nextnode] Element or jQuery-selector string to the item that
		 *  the new item should be added before, should be another item in the same
		 *  list, it will be ignored otherwise
		 *
		 * @return {HTMLElement|null} The added element (a ListItem or Anchor element,
		 * depending on the skin) or null if no element was added to the document.
		 */
		addPortletLink: function ( portlet, href, text, id, tooltip, accesskey, nextnode ) {
			var $item, $link, $portlet, $ul;

			// Check if there's atleast 3 arguments to prevent a TypeError
			if ( arguments.length < 3 ) {
				return null;
			}
			// Setup the anchor tag
			$link = $( '<a>' ).attr( 'href', href ).text( text );
			if ( tooltip ) {
				$link.attr( 'title', tooltip );
			}

			// Select the specified portlet
			$portlet = $( '#' + portlet );
			if ( $portlet.length === 0 ) {
				return null;
			}
			// Select the first (most likely only) unordered list inside the portlet
			$ul = $portlet.find( 'ul' ).eq( 0 );

			// If it didn't have an unordered list yet, create it
			if ( $ul.length === 0 ) {

				$ul = $( '<ul>' );

				// If there's no <div> inside, append it to the portlet directly
				if ( $portlet.find( 'div:first' ).length === 0 ) {
					$portlet.append( $ul );
				} else {
					// otherwise if there's a div (such as div.body or div.pBody)
					// append the <ul> to last (most likely only) div
					$portlet.find( 'div' ).eq( -1 ).append( $ul );
				}
			}
			// Just in case..
			if ( $ul.length === 0 ) {
				return null;
			}

			// Unhide portlet if it was hidden before
			$portlet.removeClass( 'emptyPortlet' );

			// Wrap the anchor tag in a list item (and a span if $portlet is a Vector tab)
			// and back up the selector to the list item
			if ( $portlet.hasClass( 'vectorTabs' ) ) {
				$item = $link.wrap( '<li><span></span></li>' ).parent().parent();
			} else {
				$item = $link.wrap( '<li></li>' ).parent();
			}

			// Implement the properties passed to the function
			if ( id ) {
				$item.attr( 'id', id );
			}

			if ( tooltip ) {
				// Trim any existing accesskey hint and the trailing space
				tooltip = $.trim( tooltip.replace( util.tooltipAccessKeyRegexp, '' ) );
				if ( accesskey ) {
					tooltip += ' [' + accesskey + ']';
				}
				$link.attr( 'title', tooltip );
				if ( accesskey ) {
					util.updateTooltipAccessKeys( $link );
				}
			}

			if ( accesskey ) {
				$link.attr( 'accesskey', accesskey );
			}

			if ( nextnode ) {
				if ( nextnode.nodeType || typeof nextnode === 'string' ) {
					// nextnode is a DOM element (was the only option before MW 1.17, in wikibits.js)
					// or nextnode is a CSS selector for jQuery
					nextnode = $ul.find( nextnode );
				} else if ( !nextnode.jquery || ( nextnode.length && nextnode[0].parentNode !== $ul[0] ) ) {
					// Fallback
					$ul.append( $item );
					return $item[0];
				}
				if ( nextnode.length === 1 ) {
					// nextnode is a jQuery object that represents exactly one element
					nextnode.before( $item );
					return $item[0];
				}
			}

			// Fallback (this is the default behavior)
			$ul.append( $item );
			return $item[0];

		},

		/**
		 * Add a little box at the top of the screen to inform the user of
		 * something, replacing any previous message.
		 * Calling with no arguments, with an empty string or null will hide the message
		 *
		 * @param {Mixed} message The DOM-element, jQuery object or HTML-string to be put inside the message box.
		 * to allow CSS/JS to hide different boxes. null = no class used.
		 * @deprecated since 1.20 Use mw#notify
		 */
		jsMessage: function ( message ) {
			if ( !arguments.length || message === '' || message === null ) {
				return true;
			}
			if ( typeof message !== 'object' ) {
				message = $.parseHTML( message );
			}
			mw.notify( message, { autoHide: true, tag: 'legacy' } );
			return true;
		},

		/**
		 * Validate a string as representing a valid e-mail address
		 * according to HTML5 specification. Please note the specification
		 * does not validate a domain with one character.
		 *
		 * FIXME: should be moved to or replaced by a validation module.
		 *
		 * @param {string} mailtxt E-mail address to be validated.
		 * @return {boolean|null} Null if `mailtxt` was an empty string, otherwise true/false
		 * as determined by validation.
		 */
		validateEmail: function ( mailtxt ) {
			var rfc5322Atext, rfc1034LdhStr, html5EmailRegexp;

			if ( mailtxt === '' ) {
				return null;
			}

			// HTML5 defines a string as valid e-mail address if it matches
			// the ABNF:
			//	1 * ( atext / "." ) "@" ldh-str 1*( "." ldh-str )
			// With:
			// - atext	: defined in RFC 5322 section 3.2.3
			// - ldh-str : defined in RFC 1034 section 3.5
			//
			// (see STD 68 / RFC 5234 http://tools.ietf.org/html/std68)
			// First, define the RFC 5322 'atext' which is pretty easy:
			// atext = ALPHA / DIGIT / ; Printable US-ASCII
			//     "!" / "#" /    ; characters not including
			//     "$" / "%" /    ; specials. Used for atoms.
			//     "&" / "'" /
			//     "*" / "+" /
			//     "-" / "/" /
			//     "=" / "?" /
			//     "^" / "_" /
			//     "`" / "{" /
			//     "|" / "}" /
			//     "~"
			rfc5322Atext = 'a-z0-9!#$%&\'*+\\-/=?^_`{|}~';

			// Next define the RFC 1034 'ldh-str'
			//	<domain> ::= <subdomain> | " "
			//	<subdomain> ::= <label> | <subdomain> "." <label>
			//	<label> ::= <letter> [ [ <ldh-str> ] <let-dig> ]
			//	<ldh-str> ::= <let-dig-hyp> | <let-dig-hyp> <ldh-str>
			//	<let-dig-hyp> ::= <let-dig> | "-"
			//	<let-dig> ::= <letter> | <digit>
			rfc1034LdhStr = 'a-z0-9\\-';

			html5EmailRegexp = new RegExp(
				// start of string
				'^'
				+
				// User part which is liberal :p
				'[' + rfc5322Atext + '\\.]+'
				+
				// 'at'
				'@'
				+
				// Domain first part
				'[' + rfc1034LdhStr + ']+'
				+
				// Optional second part and following are separated by a dot
				'(?:\\.[' + rfc1034LdhStr + ']+)*'
				+
				// End of string
				'$',
				// RegExp is case insensitive
				'i'
			);
			return (null !== mailtxt.match( html5EmailRegexp ) );
		},

		/**
		 * Note: borrows from IP::isIPv4
		 *
		 * @param {string} address
		 * @param {boolean} allowBlock
		 * @return {boolean}
		 */
		isIPv4Address: function ( address, allowBlock ) {
			if ( typeof address !== 'string' ) {
				return false;
			}

			var	block = allowBlock ? '(?:\\/(?:3[0-2]|[12]?\\d))?' : '',
				RE_IP_BYTE = '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|0?[0-9]?[0-9])',
				RE_IP_ADD = '(?:' + RE_IP_BYTE + '\\.){3}' + RE_IP_BYTE;

			return address.search( new RegExp( '^' + RE_IP_ADD + block + '$' ) ) !== -1;
		},

		/**
		 * Note: borrows from IP::isIPv6
		 *
		 * @param {string} address
		 * @param {boolean} allowBlock
		 * @return {boolean}
		 */
		isIPv6Address: function ( address, allowBlock ) {
			if ( typeof address !== 'string' ) {
				return false;
			}

			var	block = allowBlock ? '(?:\\/(?:12[0-8]|1[01][0-9]|[1-9]?\\d))?' : '',
				RE_IPV6_ADD =
			'(?:' + // starts with "::" (including "::")
			':(?::|(?::' + '[0-9A-Fa-f]{1,4}' + '){1,7})' +
			'|' + // ends with "::" (except "::")
			'[0-9A-Fa-f]{1,4}' + '(?::' + '[0-9A-Fa-f]{1,4}' + '){0,6}::' +
			'|' + // contains no "::"
			'[0-9A-Fa-f]{1,4}' + '(?::' + '[0-9A-Fa-f]{1,4}' + '){7}' +
			')';

			if ( address.search( new RegExp( '^' + RE_IPV6_ADD + block + '$' ) ) !== -1 ) {
				return true;
			}

			RE_IPV6_ADD = // contains one "::" in the middle (single '::' check below)
				'[0-9A-Fa-f]{1,4}' + '(?:::?' + '[0-9A-Fa-f]{1,4}' + '){1,6}';

			return address.search( new RegExp( '^' + RE_IPV6_ADD + block + '$' ) ) !== -1
				&& address.search( /::/ ) !== -1 && address.search( /::.*::/ ) === -1;
		}
	};

	/**
	 * @method wikiGetlink
	 * @inheritdoc #getUrl
	 * @deprecated since 1.23 Use #getUrl instead.
	 */
	mw.log.deprecate( util, 'wikiGetlink', util.getUrl, 'Use mw.util.getUrl instead.' );

	mw.util = util;

}( mediaWiki, jQuery ) );
