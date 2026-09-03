import { useState, useEffect } from "react";
import type { User } from "./user";



interface UserFormData{
    name: string;
    role: string;
}
interface props{
    user? : User|null;
    onSave : (data:UserFormData)=>Promise<void>;
    onCancel : ()=>void;
    onDeactivate?:(id:number)=>Promise<void>;
}

const INPUT_CLASS = "w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400";

export default function UserForm({user,onSave,onCancel,onDeactivate}:props){

    // input Field wala agayan thiyaganna 
    const[name,setName]=useState('');
    const[role,setRole]=useState('');
    const[isSaving,setIsSaving]=useState(false);
    const[errors, setErrors] = useState<Record<string, string>>({});


    useEffect(()=>{
        if(user){
            setName(user.name);
            setRole(user.role);
        }
    }, [user]);     

    const validate =():boolean =>{
        const newErrors:Record<string,string> = {};
        if(!name.trim()) newErrors.name="Name is required";
        if(!role.trim()) newErrors.role="Role is required";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }
    
    const handleSubmit = async(e:React.FormEvent)=>{
        e.preventDefault();
        if(!validate()) return;
        setIsSaving(true);
        setErrors({});
        try{
            await onSave({name,role});
        }finally{
            setIsSaving(false);
        }
    };
        return(
            <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-6">
                {/* Name */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="name" className="text-xs font-medium text-slate-700 ">Name</label>
                    <input type="text" value={name} onChange={(e)=>setName(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="e.g. john"/>
                    {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
                </div>

                {/* Role */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="role" className="text-xs font-medium text-slate-700 ">Role</label>
                    <input type="text" value={role} onChange={(e)=>setRole(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="e.g. operator"/>
                    {errors.role && <p className="text-red-500 text-sm">{errors.role}</p>}
                </div>

                {/* Submit buttons */}
                <div className="flex flex-col gap-2">
                    <button type="submit" disabled={isSaving || !name.trim()|| !role.trim()}
                    className="w-full bg-blue-700 text-white font-medium rounded-lg min-h-[52px] px-4 transition-colors hover:bg-blue-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Saving...' : user ? 'Update user' : 'Create user'}
                    </button>

                    {user && onDeactivate && (
                        <button type="button"
                         onClick={()=>onDeactivate(user.id)}
                         disabled={isSaving}
                         className="w-full border border-slate-300 bg-white rounded-lg min-h-[52px] px-4 text-slate-600 font-medium transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                         >
                            Deactivate user
                         </button>
                    )}

                        <button type="button"
                        onClick={onCancel}
                        disabled={isSaving}
                        className="w-full border border-slate-300 bg-white rounded-lg min-h-[52px] px-4 text-slate-600 font-medium transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>

                </div>  
                    
            </form>
    )
}