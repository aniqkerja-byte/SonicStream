const globals = require('globals');

module.exports = [
  {
    files: ['server.js', 'public/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.node,
        showAddPlaylistModal: 'readonly',
        deleteSongFromLibrary: 'readonly',
        removeSongFromPlaylist: 'readonly',
        addSongToPlaylist: 'readonly',
        toggleSongSelection: 'readonly',
        toggleBulkSongItem: 'readonly',
        renderBulkSongs: 'readonly',
        updateBulkCount: 'readonly',
        toggleSelectionMode: 'readonly',
        toggleSelectAllSongs: 'readonly',
        deleteSelectedSongs: 'readonly',
        openBulkAddModal: 'readonly',
        selectAllBulk: 'readonly',
        submitBulkAdd: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-unreachable': 'error'
    }
  }
];
