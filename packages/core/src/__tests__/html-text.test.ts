import { stripDmsBoilerplateForUi } from '../parser/html-text';

describe('stripDmsBoilerplateForUi', () => {
  it('removes phase boilerplate and duplicate delay headline', () => {
    const raw =
      'Current Requested Message at: 2026/03/23, 17:37:41 (1 phase message) Message Phase 1: (This Phase is in Automatic Control Mode) LIONS GATE DELAYS 10 MIN';
    expect(stripDmsBoilerplateForUi(raw)).toBe(
      'Current Requested Message at: 2026/03/23, 17:37:41',
    );
  });
});
