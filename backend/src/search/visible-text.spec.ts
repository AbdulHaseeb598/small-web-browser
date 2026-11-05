import { visibleText } from './visible-text.js';

describe('HTML text extraction for search', () => {
  it('decodes entities and separates block/inline text without indexing tags or attributes', () => {
    expect(
      visibleText(
        '<h1>Ocean &amp; sky</h1><p class="hiddenkeyword">Kelp <strong>forest</strong></p>',
      ),
    ).toBe('Ocean & sky Kelp forest');
  });
  it('ignores scripts, styles, metadata, templates, and explicitly hidden content', () => {
    const html =
      '<head><title>not-page-title</title><meta content="secret"></head><body><script>danger</script><style>csskeyword</style><template>templateword</template><p hidden>hiddenword</p><p aria-hidden="true">ariaword</p><p style="display:none">styleword</p><p>Visible coast</p></body>';
    expect(visibleText(html)).toBe('Visible coast');
  });
  it('handles malformed HTML and comments without executing or fetching anything', () => {
    expect(
      visibleText(
        '<div>Mangrove <b>roots</div><!-- commentword --><p>brackish',
      ),
    ).toBe('Mangrove roots brackish');
  });
});
