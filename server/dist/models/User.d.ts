import mongoose from 'mongoose';
export interface IUser extends mongoose.Document {
    name: string;
    email: string;
    password: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}
declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser> & IUser & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default User;
