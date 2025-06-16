use anchor_lang::prelude::*;
use constant::*;
use error::AppError;
use state::{Profile, Todo};

declare_id!("3othBZz4gCMsNvm6t5cqLn7FBvy6SVjoTt45HHmJT95H");

mod constant;
mod error;
mod state;

#[program]
pub mod todo_app {
    use super::*;

    pub fn create_profile(ctx: Context<CreateProfile>, name: String) -> Result<()> {
        require!(name.len() <= 100, AppError::NameTooLong);

        let key = ctx.accounts.profile.key();

        let profile = &mut ctx.accounts.profile;

        profile.key = key;
        profile.name = name;
        profile.authority = ctx.accounts.creator.key();
        profile.todo_count = 0;

        Ok(())
    }

    pub fn create_todo(ctx: Context<CreateTodo>, content: String) -> Result<()> {
        if content.len() > 200 {
            return err!(AppError::ContentTooLong);
        }

        let profile = &mut ctx.accounts.profile;
        let todo = &mut ctx.accounts.todo;

        todo.creator = ctx.accounts.creator.key();
        todo.profile = profile.key();
        todo.content = content;
        todo.completed = false;
        todo.index = profile.todo_count;

        profile.todo_count += 1;

        Ok(())
    }

    pub fn toggle_todo(ctx: Context<ToggleTodo>) -> Result<()> {
        let todo = &mut ctx.accounts.todo;
        todo.completed = !todo.completed;
        Ok(())
    }

    pub fn delete_todo(ctx: Context<DeleteTodo>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.todo_count = profile.todo_count.saturating_sub(1);
        Ok(())
    }
}

// Account structs
#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Profile::SPACE,
        seeds = [b"profile", creator.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateTodo<'info> {
    #[account(mut)]
    creator: Signer<'info>,

    #[account(mut, 
        constraint = profile.authority == creator.key() @ AppError::InvalidAuthority
    )]
    profile: Account<'info, Profile>,

    #[account(
        init,
        payer = creator,
        space = 8 + Todo::INIT_SPACE,
        seeds = [b"todo", profile.key().as_ref(), profile.todo_count.to_le_bytes().as_ref()],
        bump
    )]
    todo: Account<'info, Todo>,

    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ToggleTodo<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"profile", creator.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    
    #[account(
        mut,
        seeds = [b"todo", profile.key().as_ref(), &[todo.index]],
        bump
    )]
    pub todo: Account<'info, Todo>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeleteTodo<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"profile", creator.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    
    #[account(
        mut,
        close = creator,
        seeds = [b"todo", profile.key().as_ref(), &[todo.index]],
        bump
    )]
    pub todo: Account<'info, Todo>,
    
    pub system_program: Program<'info, System>,
}