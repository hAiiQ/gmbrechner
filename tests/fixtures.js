// Existing accounting tests exercise management workflows. Their named test
// users are explicitly assigned that role; production authorization stays on.
export async function grantTestManager(db,result){
  if(result.status===200&&result.data?.employee?.id)await db.query("UPDATE employees SET role='Manager' WHERE id=$1 AND role='Barkeeper'",[result.data.employee.id]);
  return result;
}
