import { Collection, Db, MongoClient, Document } from 'mongodb';

declare module 'mongodb' {
  interface Collection<TSchema = Document> {
    countDocuments(query?: object, options?: any): Promise<number>;
    find(query?: object, options?: any): any;
    findOne(query?: object, options?: any): Promise<TSchema | null>;
    insertOne(doc: TSchema, options?: any): Promise<any>;
    insertMany(docs: TSchema[], options?: any): Promise<any>;
    updateOne(query: object, update: object, options?: any): Promise<any>;
    updateMany(query: object, update: object, options?: any): Promise<any>;
    deleteOne(query: object, options?: any): Promise<any>;
    deleteMany(query: object, options?: any): Promise<any>;
    aggregate(pipeline: object[], options?: any): any;
    createIndex(indexSpec: object, options?: any): Promise<any>;
  }
}
