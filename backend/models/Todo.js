import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema(
  {
    task: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    person: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    fromDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    toDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    done: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

todoSchema.set('toJSON', {
  transform(_document, result) {
    result.id = result._id.toString();
    delete result._id;
    delete result.__v;
    return result;
  },
});

export default mongoose.model('Todo', todoSchema);
