import mongoose from 'mongoose';

/**
 * Ensure update queries run schema validators instead of silently bypassing
 * model-level constraints. Applied globally before model compilation.
 */
mongoose.plugin((schema) => {
  schema.pre(
    ['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne', 'findOneAndReplace'],
    function () {
      this.setOptions({ runValidators: true });
    },
  );
});
