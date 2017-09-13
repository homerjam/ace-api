'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _class;

var _mjmlCore = require('mjml-core');

var _cloneDeep = require('lodash/cloneDeep');

var _cloneDeep2 = _interopRequireDefault(_cloneDeep);

var _merge = require('lodash/merge');

var _merge2 = _interopRequireDefault(_merge);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _mjmlColumn = require('mjml-column');

var _mjmlColumn2 = _interopRequireDefault(_mjmlColumn);

var _mjmlGroup = require('mjml-group');

var _mjmlGroup2 = _interopRequireDefault(_mjmlGroup);

var _mjmlRaw = require('mjml-raw');

var _mjmlRaw2 = _interopRequireDefault(_mjmlRaw);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var tagName = 'mc-section';
var parentTag = ['mj-container'];
var defaultMJMLDefinition = {
  attributes: {
    'mc:hideable': null,
    'mc:repeatable': null,
    'mc:variant': null,
    'mc:edit': null,
    'background-color': null,
    'background-url': null,
    'background-repeat': 'repeat',
    'background-size': 'auto',
    'border': null,
    'border-bottom': null,
    'border-left': null,
    'border-radius': null,
    'border-right': null,
    'border-top': null,
    'direction': 'ltr',
    'full-width': null,
    'padding': '20px 0',
    'padding-top': null,
    'padding-bottom': null,
    'padding-left': null,
    'padding-right': null,
    'text-align': 'center',
    'vertical-align': 'top'
  }
};
var baseStyles = {
  div: {
    margin: '0 auto'
  },
  table: {
    fontSize: '0px',
    width: '100%'
  },
  td: {
    textAlign: 'center',
    verticalAlign: 'top'
  }
};
var postRender = function postRender($) {
  $('.mc-section-outlook-background').each(function () {
    var url = $(this).data('url');
    var width = $(this).data('width');

    $(this).removeAttr('class').removeAttr('data-url').removeAttr('data-width');

    if (!url) {
      return;
    }

    $(this).before(_mjmlCore.helpers.startConditionalTag + '\n      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:' + width + 'px;">\n        <v:fill origin="0.5, 0" position="0.5,0" type="tile" src="' + url + '" />\n        <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">\n      ' + _mjmlCore.helpers.endConditionalTag);

    $(this).after(_mjmlCore.helpers.startConditionalTag + '\n        </v:textbox>\n      </v:rect>\n      ' + _mjmlCore.helpers.endConditionalTag);
  });

  $('.mc-section-outlook-open').each(function () {
    var $columnDiv = $(this).next();

    $(this).replaceWith(_mjmlCore.helpers.startConditionalTag + '\n      <table border="0" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:' + $columnDiv.data('vertical-align') + ';width:' + parseInt($(this).data('width')) + 'px;">\n      ' + _mjmlCore.helpers.endConditionalTag);

    $columnDiv.removeAttr('data-vertical-align');
  });

  $('.mc-section-outlook-line').each(function () {
    var $columnDiv = $(this).next();

    $(this).replaceWith(_mjmlCore.helpers.startConditionalTag + '\n      </td><td style="vertical-align:' + $columnDiv.data('vertical-align') + ';width:' + parseInt($(this).data('width')) + 'px;">\n      ' + _mjmlCore.helpers.endConditionalTag);

    $columnDiv.removeAttr('data-vertical-align');
  });

  $('.mc-section-outlook-close').each(function () {
    $(this).replaceWith(_mjmlCore.helpers.startConditionalTag + '\n      </td></tr></table>\n      ' + _mjmlCore.helpers.endConditionalTag);
  });

  $('[data-mc-hideable]').each(function () {
    $(this).attr('mc:hideable', '').removeAttr('data-mc-hideable');
  });

  $('[data-mc-repeatable]').each(function () {
    $(this).attr('mc:repeatable', $(this).attr('data-mc-repeatable'));
    // .removeAttr('data-mc-repeatable')
  });

  $('[data-mc-variant]').each(function () {
    $(this).attr('mc:variant', $(this).attr('data-mc-variant'));
    // .removeAttr('data-mc-variant')
  });

  $('[data-mc-edit]').each(function () {
    $(this).attr('mc:edit', $(this).attr('data-mc-edit')).removeAttr('data-mc-edit');
  });

  return $;
};

var Section = (0, _mjmlCore.MJMLElement)(_class = function (_Component) {
  _inherits(Section, _Component);

  function Section() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, Section);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Section.__proto__ || Object.getPrototypeOf(Section)).call.apply(_ref, [this].concat(args))), _this), _this.styles = _this.getStyles(), _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(Section, [{
    key: 'isFullWidth',
    value: function isFullWidth() {
      var mjAttribute = this.props.mjAttribute;


      return mjAttribute('full-width') == 'full-width';
    }
  }, {
    key: 'getStyles',
    value: function getStyles() {
      var _props = this.props,
          mjAttribute = _props.mjAttribute,
          parentWidth = _props.parentWidth,
          defaultUnit = _props.defaultUnit;


      var background = mjAttribute('background-url') ? {
        background: ((mjAttribute('background-color') || '') + ' url(' + mjAttribute('background-url') + ') top center / ' + (mjAttribute('background-size') || '') + ' ' + (mjAttribute('background-repeat') || '')).trim()
      } : {
        background: mjAttribute('background-color')
      };

      return (0, _merge2.default)({}, baseStyles, {
        td: {
          fontSize: '0px',
          padding: defaultUnit(mjAttribute('padding'), 'px'),
          paddingBottom: defaultUnit(mjAttribute('padding-bottom'), 'px'),
          paddingLeft: defaultUnit(mjAttribute('padding-left'), 'px'),
          paddingRight: defaultUnit(mjAttribute('padding-right'), 'px'),
          paddingTop: defaultUnit(mjAttribute('padding-top'), 'px'),
          textAlign: mjAttribute('text-align'),
          verticalAlign: mjAttribute('vertical-align')
        },
        div: {
          maxWidth: defaultUnit(parentWidth)
        }
      }, {
        div: this.isFullWidth() ? {} : (0, _cloneDeep2.default)(background),
        table: this.isFullWidth() ? {} : (0, _cloneDeep2.default)(background),
        tableFullwidth: this.isFullWidth() ? (0, _cloneDeep2.default)(background) : {}
      });
    }
  }, {
    key: 'renderFullWidthSection',
    value: function renderFullWidthSection() {
      var mjAttribute = this.props.mjAttribute;


      return _react2.default.createElement(
        'table',
        {
          cellPadding: '0',
          cellSpacing: '0',
          'data-legacy-background': mjAttribute('background-url'),
          'data-legacy-border': '0',
          'data-mc-hideable': mjAttribute('mc:hideable'),
          'data-mc-repeatable': mjAttribute('mc:repeatable'),
          'data-mc-variant': mjAttribute('mc:variant'),
          'data-mc-edit': mjAttribute('mc:edit'),
          style: (0, _merge2.default)({}, this.styles.tableFullwidth, this.styles.table) },
        _react2.default.createElement(
          'tbody',
          null,
          _react2.default.createElement(
            'tr',
            null,
            _react2.default.createElement(
              'td',
              null,
              this.renderSection()
            )
          )
        )
      );
    }
  }, {
    key: 'renderSection',
    value: function renderSection() {
      var _props2 = this.props,
          renderWrappedOutlookChildren = _props2.renderWrappedOutlookChildren,
          mjAttribute = _props2.mjAttribute,
          children = _props2.children,
          parentWidth = _props2.parentWidth;

      var fullWidth = this.isFullWidth();

      return _react2.default.createElement(
        'div',
        {
          'data-mc-hideable': mjAttribute('mc:hideable'),
          'data-mc-repeatable': mjAttribute('mc:repeatable'),
          'data-mc-variant': mjAttribute('mc:variant'),
          'data-mc-edit': mjAttribute('mc:edit'),
          style: this.styles.div },
        _react2.default.createElement(
          'table',
          {
            cellPadding: '0',
            cellSpacing: '0',
            className: 'mc-section-outlook-background',
            'data-legacy-align': 'center',
            'data-legacy-background': fullWidth ? undefined : mjAttribute('background-url'),
            'data-legacy-border': '0',
            'data-url': mjAttribute('background-url') || '',
            'data-width': parentWidth,
            style: this.styles.table },
          _react2.default.createElement(
            'tbody',
            null,
            _react2.default.createElement(
              'tr',
              null,
              _react2.default.createElement(
                'td',
                { style: this.styles.td },
                renderWrappedOutlookChildren(children)
              )
            )
          )
        )
      );
    }
  }, {
    key: 'render',
    value: function render() {
      return this.isFullWidth() ? this.renderFullWidthSection() : this.renderSection();
    }
  }]);

  return Section;
}(_react.Component)) || _class;

Section.tagName = tagName;
Section.parentTag = parentTag;
Section.defaultMJMLDefinition = defaultMJMLDefinition;
Section.baseStyles = baseStyles;
Section.postRender = postRender;

_mjmlColumn2.default.parentTag.push(tagName);

_mjmlGroup2.default.parentTag.push(tagName);

_mjmlRaw2.default.parentTag.push(tagName);

exports.default = Section;
