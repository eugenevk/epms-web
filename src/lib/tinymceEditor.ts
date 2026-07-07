import 'tinymce/tinymce'
import 'tinymce/icons/default'
import 'tinymce/themes/silver'
import 'tinymce/models/dom'

import 'tinymce/plugins/advlist'
import 'tinymce/plugins/anchor'
import 'tinymce/plugins/autolink'
import 'tinymce/plugins/autoresize'
import 'tinymce/plugins/charmap'
import 'tinymce/plugins/code'
import 'tinymce/plugins/codesample'
import 'tinymce/plugins/directionality'
import 'tinymce/plugins/fullscreen'
import 'tinymce/plugins/link'
import 'tinymce/plugins/lists'
import 'tinymce/plugins/nonbreaking'
import 'tinymce/plugins/preview'
import 'tinymce/plugins/searchreplace'
import 'tinymce/plugins/table'
import 'tinymce/plugins/visualblocks'
import 'tinymce/plugins/wordcount'

import 'tinymce/skins/ui/oxide/skin.min.css'
import 'tinymce/skins/content/default/content.min.css'

import poppins400 from '@fontsource/poppins/400.css?url'
import poppins600 from '@fontsource/poppins/600.css?url'
import poppins700 from '@fontsource/poppins/700.css?url'

import type { RawEditorOptions } from 'tinymce'

const RICH_TEXT_FONT_FAMILY_FORMATS =
  'Poppins=Poppins,sans-serif;' +
  'Arial=arial,helvetica,sans-serif;' +
  'Helvetica=helvetica,arial,sans-serif;' +
  'Times New Roman=times new roman,times,serif;' +
  'Georgia=georgia,palatino,serif;' +
  'Courier New=courier new,courier,monospace;' +
  'Verdana=verdana,geneva,sans-serif;' +
  'Tahoma=tahoma,arial,helvetica,sans-serif;' +
  'Trebuchet MS=trebuchet ms,geneva,sans-serif;' +
  'Inter=Inter,sans-serif'

const RICH_TEXT_CONTENT_STYLE = `
  body {
    font-family: Poppins, sans-serif;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.6;
    color: #44403c;
    margin: 12px;
  }
  p, ul, ol, h1, h2, h3, h4, h5, h6 { margin: 0 0 0.75rem; }
  ul, ol { padding-left: 1.25rem; }
  ul { list-style: disc; }
  ol { list-style: decimal; }
  a { color: #166534; text-decoration: underline; text-underline-offset: 2px; }
  blockquote {
    margin: 0 0 0.75rem;
    padding-left: 1rem;
    border-left: 4px solid #d6d3d1;
    color: #57534e;
    font-style: italic;
  }
  pre, code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    background: #f5f5f4;
    border-radius: 0.25rem;
  }
  pre { padding: 0.5rem 0.75rem; overflow-x: auto; }
  code { padding: 0.125rem 0.25rem; }
`

export function createRichTextEditorInit(
  placeholder?: string,
  options: { minHeight?: number } = {},
): RawEditorOptions {
  return {
    license_key: 'gpl',
    promotion: false,
    branding: false,
    menubar: false,
    statusbar: true,
    min_height: options.minHeight ?? 240,
    autoresize_bottom_margin: 12,
    plugins: [
      'advlist',
      'anchor',
      'autolink',
      'autoresize',
      'charmap',
      'code',
      'codesample',
      'directionality',
      'fullscreen',
      'link',
      'lists',
      'nonbreaking',
      'preview',
      'searchreplace',
      'table',
      'visualblocks',
      'wordcount',
    ].join(' '),
    toolbar:
      'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough subscript superscript | ' +
      'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ' +
      'link table charmap hr codesample | removeformat | searchreplace preview code fullscreen',
    block_formats:
      'Paragraph=p;Heading 1=h1;Heading 2=h2;Heading 3=h3;Heading 4=h4;Heading 5=h5;Heading 6=h6;Preformatted=pre',
    font_family_formats: RICH_TEXT_FONT_FAMILY_FORMATS,
    default_font_stack: ['Poppins', 'sans-serif'],
    font_size_formats: '8pt 10pt 12pt 14pt 16pt 18pt 24pt 36pt',
    font_css: [poppins400, poppins600, poppins700],
    extended_valid_elements:
      'font[class|color|face|size|style],span[class|style|data-mce-style|data-mce-bogus]',
    placeholder,
    content_style: RICH_TEXT_CONTENT_STYLE,
    link_default_target: '_blank',
    link_assume_external_targets: 'https',
    convert_urls: false,
    entity_encoding: 'raw',
    paste_data_images: false,
    browser_spellcheck: true,
  }
}
